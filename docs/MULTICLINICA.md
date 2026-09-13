# Meu Rim — expansão multiclinica (fundação)

Documento de diagnóstico e plano. **Não substitui o sistema em produção.**
Nenhuma tabela existente é apagada. IDs atuais são preservados.

## 1. Diagnóstico da arquitetura atual

- Uma app Next.js 15 (App Router). Sem ORM. Persistência em **Supabase/Postgres** quando `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` existem; senão **JSON** em `data/`.
- **Não há tabela `users` unificada.** Cada papel tem sessão própria (cookie HMAC + bcrypt):
  - Médico: `doctors` + cookie `meurim_doctor_session` (payload = **doctor UUID**)
  - Paciente, atendente, nutricionista, allied, admin de env (`ADMIN_EMAIL`/`ADMIN_PASSWORD`)
- **Tenant atual = `doctor_id`**, não clínica. O campo `doctors.clinic` é texto livre. Locais de agenda (`locations` JSONB) não são clínicas SaaS.
- Paciente de cadastro: tabela `patients` (UUID, `doctor_id`). Prontuário (evoluções, exames, documentos) usa **`patient_email` / clinical key** (`email` ou `pid:{uuid}`), não FK de clínica.
- `junoresidencia@gmail.com` **não está no seed**. Existe só no banco de produção. Qualquer papel extra deve ser um **vínculo no ID já existente**.
- `/admin` atual = admin de plataforma por senha de ambiente (aprovação de médicos). **Não é** o dashboard médico e **não deve ser misturado** com o trabalho clínico.
- `/medicos/painel` é o dashboard médico. **Não reconstruir.**
- Financeiro atual = pagamento de consulta (Mercado Pago / Pix) + `commissionPercent` global do médico. Não há produção clínica, fechamento nem repasse por clínica.
- Encaminhamento médico↔médico já existe (`patient_doctor_shares`). Atendente já existe, mas vinculada ao **médico**, não à clínica.

## 2. Tabelas / entidades que serão adicionadas

Somente **CREATE**. Nenhuma DROP/RENAME de tabela existente.

| Entidade | Fase | Função |
|---|---|---|
| `platform_role_assignments` | 1 | Papéis extras no ator já existente (`doctor` / futuro `attendant`). Ex.: SUPER_ADMIN no Dr. Juno sem novo usuário. |
| `clinics` | 1 | Clínica (nome, status, cadastro). Sem vínculos obrigatórios nos registros antigos. |
| `clinic_memberships` | 1 | usuário + clínica + papel + status + permissões. |
| `clinic_invites` | 2 | Convite de médico/atendente sem a gestora criar senha. |
| `clinic_patient_links` | 2 | Vínculo paciente↔clínica **depois** da fundação. Pacientes atuais continuam só com `doctor_id`. |
| `clinic_fee_rules` | 3 | Valor/repasse no vínculo MÉDICO↔CLÍNICA. |
| `clinic_encounters` | 3 | Produção (atendido ≠ recebido). |
| `clinic_payments` | 3 | Check-in financeiro da atendente. |
| `clinic_closings` | 4 | Fechamento + código único `MED-AAAA-######`. |
| `clinic_closing_adjustments` | 4 | Ajuste auditado após pago. |
| `platform_audit_log` | 1 | Auditoria de ações de plataforma/clínica. |
| `platform_integrity_snapshots` | 1 | Contagens antes/depois (abortar se diminuir). |

Colunas opcionais futuras (nunca obrigatórias nos registros atuais): `clinic_id` em bookings/encounters **novos**. Pacientes antigos funcionam sem ela.

## 3. Migrations planejadas

1. **`20260913010000_platform_clinics_roles.sql` (Fase 1, esta PR)** — cria as 4 tabelas da fundação. Idempotente (`IF NOT EXISTS`). Sem ALTER em `doctors`/`patients`/`bookings`.
2. Fase 2 — convites + `clinic_patient_links` (aditivo).
3. Fase 3 — financeiro da clínica (tabelas novas).
4. Fase 4 — fechamentos/PDF.
5. Fase 5 — encaminhamento intra-clínica (em cima de `patient_doctor_shares`).

**Não aplicar em produção nesta PR.** Arquivo de migration vai no repo; staging/dev primeiro. Backup obrigatório antes de rodar no Postgres de produção.

## 4. Riscos

| Risco | Mitigação |
|---|---|
| Trocar ID do Dr. Juno / novo usuário | Proibido. SUPER_ADMIN é assignment no `doctors.id` já existente (lookup por e-mail). |
| Exigir `clinic_id` nos pacientes atuais | Proibido na Fase 1–2. Fallback: acesso continua por `doctor_id` + shares. |
| Dashboard médico virar admin | Área nova em `/plataforma`. Painel `/medicos/painel` intacto. |
| CPF global vazar clínica do paciente | Lookup futuro confirma dados mas **não lista outras clínicas**. |
| Migration destrutiva | Só CREATE. Contagens antes/depois. Abortar se alguma diminuir. |
| Sessão médica quebrar | Cookie e token do médico **não mudam**. |
| `/admin` de env parar | Não alterado. |

## 5. Rollback

- Fase 1 é só tabelas/arquivos novos + um link condicional na sidebar.
- Rollback de código: reverter o PR. Login, pacientes e painel voltam ao estado anterior.
- Rollback de schema (se a migration tiver rodado em staging): `DROP TABLE` apenas das tabelas **novas** (`platform_role_assignments`, `clinics`, `clinic_memberships`, `platform_audit_log`, `platform_integrity_snapshots`). Nunca dropar `doctors`/`patients`.
- Dados clínicos não são tocados; não há job de “mover pacientes”.

## 6. Fases

1. **Fundação (esta entrega)** — diagnóstico, tabelas, SUPER_ADMIN no login existente, `/plataforma`, integridade, fallback sem clínica.
2. **Multi-clínica operacional** — gestora, convite de médico, atendente por clínica. Sem migrar em lote os 200+ pacientes.
3. **Financeiro da clínica** — produção ≠ recebido, regras no vínculo médico↔clínica.
4. **Fechamento + PDF + repasse + comprovante.**
5. **Encaminhamentos intra-clínica + rede de cuidado.**
6. **Inteligência clínica configurável (nunca automático).**
7. **Pesquisa com governança própria.**
8. **SaaS Meu Rim** (planos/licenças/MRR) — separado do financeiro da clínica.

Critério de bloqueio: se login, pacientes, prontuário, exames, documentos ou agenda do Dr. Juno quebrarem, **não avançar de fase**.
