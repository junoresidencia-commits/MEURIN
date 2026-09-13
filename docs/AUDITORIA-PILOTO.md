# Auditoria de prontidão — Meu Rim (piloto das primeiras clínicas)

**Data:** 13/09/2026  
**Escopo:** código na `main` após as fases 1–8 da plataforma multiclinica.  
**O que NÃO foi feito nesta auditoria:** alterar login, pacientes, dashboard médico, prontuário, evoluções, documentos ou agenda atual.

Prioridade pedida: **segurança + performance + financeiro correto + facilidade de uso + zero perda de dados.**

Contagens de produção no momento da auditoria (somente leitura):

| Entidade | Quantidade |
|---|---|
| Pacientes | 222 (todos no `doctor_id` do Dr. Juno) |
| Evoluções | 293 |
| Documentos | 341 |
| Exames | 2376 |
| Médicos | 3 |
| Consultas (`bookings`) | 2 |
| Clínicas | 1 |
| Fechamentos | 0 |
| Tabelas SaaS (`saas_plans` / `saas_licenses`) | ainda não criadas em produção |

---

## 1. Problemas encontrados (classificados)

### Crítico

#### C1 — `SESSION_SECRET` com fallback público

- **O que acontece:** se `SESSION_SECRET` não estiver definido no ambiente, cookies de médico, paciente, atendente, admin, nutri e equipe usam `meu-rim-dev-secret-change-me`.
- **Risco:** qualquer pessoa que conheça o UUID do médico (listado em `GET /api/doctors`) pode forjar sessão e entrar como aquele médico. Isso inclui o login atual.
- **Correção:** definir `SESSION_SECRET` forte na Vercel/produção **antes** de mudar o código. Só depois remover o fallback em produção. Mudar o fallback agora, sem o secret no ambiente, **derruba todas as sessões** — não fazer isso sem o secret já gravado.
- **Arquivos:** `src/lib/auth.ts`, `src/lib/admin-session.ts`, `src/lib/attendant-session.ts`, `src/lib/patient-session.ts`, `src/lib/nutrition-session.ts`, `src/lib/allied-session.ts`, `src/lib/crypto-secrets.ts`
- **Altera banco:** não
- **Como testar:** na Vercel, conferir que `SESSION_SECRET` existe. Em `/plataforma/saude` o item deve aparecer como configurado. Login atual continua funcionando.
- **Como reverter:** recolocar o fallback (não recomendado em produção).

#### C2 — Sinalização WebRTC e sala sem autenticação

- **O que acontece:** `GET/POST /api/signaling` aceita qualquer `roomId`. Cada chamada faz `readDb()` / `updateDb()` (snapshot inteiro). `GET /api/rooms/[roomId]` devolve nome do paciente sem sessão se a consulta estiver confirmada.
- **Risco:** vazamento de nome de paciente; carga desnecessária no banco; possível injeção de sinal em sala alheia se o `roomId` for adivinhável.
- **Correção (depois do piloto, com cuidado):** exigir token de sessão do médico ou do paciente daquela consulta. Não fazer agora se isso quebrar a teleconsulta em uso.
- **Arquivos:** `src/app/api/signaling/route.ts`, `src/app/api/rooms/[roomId]/route.ts`, `src/lib/store.ts`
- **Altera banco:** não
- **Como testar:** abrir `/consulta/[roomId]` autenticado vs. sem cookie.
- **Como reverter:** reabrir a rota anônima.

#### C3 — Cron de lembretes aberto sem `CRON_SECRET`

- **O que acontece:** `if (!secret) return true`. Qualquer um pode disparar o sweep. Mesmo com secret, o header `x-vercel-cron` sozinho autoriza.
- **Risco:** envio em massa de lembretes; carga no banco.
- **Correção:** definir `CRON_SECRET` na Vercel. Só então falhar fechado quando o secret faltar. Não falhar fechado agora se o cron de produção depende do header da Vercel.
- **Arquivos:** `src/app/api/cron/reminders/route.ts`, `vercel.json`
- **Altera banco:** não
- **Como testar:** `GET /api/cron/reminders` sem secret deve 401 em produção; a cron da Vercel continua 200.
- **Como reverter:** voltar a aceitar ausência de secret só em `NODE_ENV=development`.

#### C4 — `readDb()` carrega a plataforma inteira

- **O que acontece:** várias telas ainda materializam médicos + consultas + pagamentos + signaling. Auth/health já foram aliviados (#105). Agenda, busca, overview e parte do prontuário ainda passam por snapshots grandes.
- **Risco:** com 5.000–50.000 pacientes as telas mais usadas ficam lentas ou estouram memória. Não é perda de dados, é risco de timeout.
- **Correção:** paginação e queries pontuais. **Não** reescrever o painel médico nesta fase. Fazer por tela, com staging.
- **Arquivos:** `src/lib/store.ts` (`readSupabaseDb`), `src/app/api/bookings/route.ts`, `src/app/api/doctor/dashboard/route.ts`, `src/app/api/doctor/patients/[email]/route.ts`
- **Altera banco:** índices aditivos, sem DROP
- **Como testar:** tempo de `/api/bookings?from=&to=` com intervalo de um dia vs. histórico inteiro.
- **Como reverter:** voltar ao `readDb()` na rota pontual.

#### C5 — Corrida ao gerar dois fechamentos ao mesmo tempo

- **O que acontece:** `createClosing` lê encontros, filtra os já usados e insere. Sem lock e sem unique de período. Dois cliques simultâneos (ou duas gestoras) podem fechar os mesmos atendimentos duas vezes.
- **Risco:** médico pago em dobro; caixa inconsistente.
- **Correção:** unique `(clinic_id, doctor_id, period_from, period_to)` + recusa se o período já existir + conferência antes de gerar. Feito de forma aditiva nesta entrega.
- **Arquivos:** `src/lib/clinic-closing-store.ts`, `supabase/migrations/20260913090000_pilot_readiness.sql`
- **Altera banco:** sim (índice único aditivo; staging primeiro)
- **Como testar:** gerar o mesmo período duas vezes; a segunda deve apontar o fechamento existente.
- **Como reverter:** dropar só o índice novo.

---

### Alto

#### A1 — Marcar repasse pago sem conferir a clínica da URL

- **O que acontece:** GET/PDF/ajuste exigem `closing.clinicId === id`. A ação `pay` não exigia.
- **Risco:** SUPER_ADMIN (ou gestora com dois IDs) poderia pagar o fechamento da clínica B pela URL da clínica A.
- **Correção:** conferir clínica antes de pagar. Feito nesta entrega.
- **Arquivos:** `src/app/api/clinica/[id]/fechamentos/[closingId]/route.ts`, `src/lib/clinic-closing-store.ts`
- **Altera banco:** não
- **Como testar:** `scripts/test-clinic-isolation.ts`
- **Como reverter:** remover a checagem (não recomendado).

#### A2 — Check-in financeiro sem trava e sem alerta de valor

- **O que acontece:** dois cliques criam dois `clinic_payments`. R$ 4.500 no lugar de R$ 450 entra sem pergunta.
- **Risco:** recebido inflado; fechamento e repasse errados.
- **Correção:** trava no botão + confirmação se o valor destoar do habitual. Não bloqueia. Feito nesta entrega (UI). O insert ainda não é transação SQL única — fica como próximo passo de staging.
- **Arquivos:** `src/app/clinica/[id]/caixa/page.tsx`, `src/lib/clinic-finance-store.ts`
- **Altera banco:** não
- **Como testar:** clicar duas vezes em “Registrar check-in”; lançar 10× o valor da consulta.
- **Como reverter:** remover a confirmação/trava da UI.

#### A3 — Sem ambiente de staging e sem backup/restore testado pela aplicação

- **O que acontece:** só existe produção (Supabase atual + Vercel). Demo JSON local não é staging. Não há último backup, tamanho nem restore testado visíveis no produto.
- **Risco:** teste destrutivo nos 222 pacientes reais; restore improvisado se o banco falhar.
- **Correção:** projeto Vercel Preview + projeto Supabase separado. PITR/backup nativo do Supabase + restore ensaiado. Runbooks em `docs/STAGING.md` e `docs/BACKUP.md`. A tela `/plataforma/saude` mostra o que o app consegue medir (integridade, secrets, tabelas). O restore real **só o dono do projeto Supabase consegue executar**.
- **Arquivos:** `docs/STAGING.md`, `docs/BACKUP.md`, `src/app/plataforma/saude/page.tsx`
- **Altera banco:** não
- **Como testar:** criar projeto staging; restaurar dump num banco vazio; comparar contagens.
- **Como reverter:** apagar o projeto staging.

#### A4 — Isolamento é por médico, não por clínica

- **O que acontece:** paciente, agenda e prontuário continuam no `doctor_id`. `clinic_patient_links` existe sem backfill (correto). SUPER_ADMIN entra em qualquer `/clinica/[id]`. Colega da mesma clínica **não** vê o prontuário sem share.
- **Risco:** gestora A não deveria ver caixa da clínica B (as rotas novas filtram `clinic_id`). Médico da clínica A **não** deve abrir paciente da B pela URL — hoje o prontuário ainda é do médico, então o risco real é outro médico/share, não o menu da clínica.
- **Correção:** testes automáticos de isolamento financeiro/clínica (feitos). Testes HTTP de URL do prontuário ficam para staging com dois logins. Não backfillar `clinic_patient_links`.
- **Arquivos:** `src/lib/platform-access.ts`, `scripts/test-clinic-isolation.ts`
- **Altera banco:** não
- **Como testar:** `scripts/test-clinic-isolation.ts` sem env de produção.
- **Como reverter:** remover o script.

#### A5 — Tabelas SaaS ainda não existem em produção

- **O que acontece:** `/plataforma/planos` mostra o catálogo em memória. Licenças **não persistem** na Vercel (FS somente leitura).
- **Risco:** gestora acha que a licença está gravada e some no próximo deploy.
- **Correção:** rodar `supabase/migrations/20260913080000_saas_plans_licenses.sql` no SQL Editor (CREATE only), primeiro em staging.
- **Arquivos:** migration Fase 8
- **Altera banco:** sim (tabelas novas)
- **Como testar:** criar licença, recarregar, ela permanece.
- **Como reverter:** `DROP TABLE` só das três tabelas SaaS.

#### A6 — Busca e agenda não vão aguentar 10–50 mil pacientes

- **O que acontece:** busca global já tem debounce (~250 ms), mas cada tecla ainda pode varrer o cohort inteiro. Agenda pede o histórico e filtra no browser. Prontuário baixa evoluções + exames + documentos + LME de uma vez.
- **Risco:** tela lenta; timeout; não é perda de dado.
- **Correção:** **proposta, não feita agora** — paginação, “hoje” na agenda, abas preguiçosas no prontuário. Fazer isso agora mudaria o comportamento das telas que você pediu para não tocar sem necessidade comprovada.
- **Arquivos:** `src/components/GlobalPatientSearch.tsx`, `src/app/api/bookings/route.ts`, `src/app/api/doctor/patients/[email]/route.ts`
- **Altera banco:** índices futuros em `patients` (nome/CPF/telefone/nascimento) e `bookings (doctor_id, slot_start)`
- **Como testar:** staging com 5.000 pacientes sintéticos (nunca produção).
- **Como reverter:** n/a (ainda não alterado).

---

### Médio

#### M1 — Sem tela de conferência antes de fechar (resolvido em parte)

Gerar fechamento ia direto. Agora há preview: atendimentos, produção, recebido, pendente, repasse, avisos e “já existe”.

#### M2 — PDF de fechamento trunca ~28 linhas e pode 500 sem frase humana

Uma página A4, sem assinatura, sem “Gerando…”. Melhorado nesta entrega (várias páginas + assinaturas + estado “Gerando”). Relatórios clínicos antigos não foram mexidos.

#### M3 — Gestora via só um hub de links

Não via consultas do dia, caixa, pendências nem “precisa de atenção”. A home da clínica agora tem resumo executivo + alertas. **Não** substitui o dashboard médico.

#### M4 — Super Admin sem “Saúde do Meu Rim”

Não havia banco / backup / secrets / prontidão numa tela só. Criadas `/plataforma/saude`, `/plataforma/metricas` e `/plataforma/prontidao`.

#### M5 — Auditoria sem filtro

`platform_audit_log` não tem `clinic_id`. Filtros por usuário, ação e data passam a existir na UI (em memória/query). Coluna `clinic_id` fica como melhoria futura (ALTER aditivo).

#### M6 — Histórico financeiro incompleto (resolvido no app)

Mudança de regra, check-in, fechamento, repasse e ajuste gravam em `clinic_finance_events` (e no JSON local se a tabela ainda não existir). Staging precisa rodar `20260913092000_clinic_finance_events.sql`.

#### M7 — Sem `CLINIC_STATUS = PILOT`

Status era `active | suspended | draft`. Incluído `pilot` (aditivo). Clínicas atuais continuam `active` até você marcar.

#### M8 — Sem auto-save da evolução

Não existe rascunho da evolução do prontuário. Existe rascunho em outro fluxo (relato de caso). **Não implementado** — mexeria no editor clínico. Recomendado na fase seguinte, sem substituir a versão final.

#### M9 — Mensagens 500 cruas em algumas APIs

Rotas novas da clínica já devolvem frase em português. Rotas antigas do médico ainda podem vazar 500. Envolver tudo agora arrisca o login. A saúde da plataforma avisa falha temporária quando o banco ou o PDF caem.

#### M10 — RLS sem policies

Tabelas novas têm RLS ligado e **nenhuma** `CREATE POLICY`. O app usa `service_role`. Seguro enquanto a chave não vazar; se vazar a anon key, o browser não lê essas tabelas (bom), mas também não há defesa em profundidade no Postgres para o service role.

#### M11 — Mobile / hover / PWA

PWA existe (`manifest`, `sw.js`). Check-in e fechamentos já são empilháveis. Botões pequenos em algumas telas antigas. Dependência de hover nas telas novas da clínica é baixa. **Não** reestilizar o painel médico agora.

#### M12 — `tableMissing` pode escrever JSON local após erro de Supabase

Se o Postgres falhar com cara de “tabela inexistente”, o store da clínica passa a gravar em `data/*.json`. Na Vercel isso some ou dá EROFS. Risco de split-brain. Mitigação já existe em parte no login (#103). Não generalizar o flip sem evidência de bug atual.

---

### Baixo

#### B1 — Site default `https://meurin.vercel.app` (um “m”)

Provável override por `NEXT_PUBLIC_APP_URL`. Conferir o env de produção.

#### B2 — Inteligência clínica já está na navegação da gestora

Você pediu para não priorizar IA agora. A tela só guarda preferências `review_only` e **não** grava no perfil. Pode ficar; não ligar motores novos.

#### B3 — Sem métricas de “médico realmente entrou”

Não há log de login (de propósito: não arriscar o auth). Métricas atuais = contagens e ações de auditoria, sem conteúdo clínico.

#### B4 — Teste de carga 20 usuários / 5.000 pacientes

Não rodado em produção (proibido). Script de isolamento + runbook de staging. Carga real só no projeto staging.

---

## 2. O que foi deliberadamente NÃO alterado

- Cookie e token do médico (`meurim_doctor_session`)
- Pacientes, evoluções, exames, documentos, receitas
- `/medicos/painel`, prontuário, agenda médica
- `/admin` por senha de ambiente
- Fluxo de teleconsulta (além de documentar C2)
- Fallback de `SESSION_SECRET` / cron aberto (até os secrets existirem na Vercel)
- Backfill de `clinic_patient_links`
- Qualquer DROP/RENAME de tabela antiga

## 3. Ordem recomendada depois desta entrega

1. Colocar `SESSION_SECRET` e `CRON_SECRET` na Vercel (sem mudar código de auth).
2. Rodar SQL da Fase 8 **e** `20260913090000_pilot_readiness.sql` em **staging**, não em produção, até o restore estar ensaiado.
3. Criar o projeto staging (ver `docs/STAGING.md`) e as clínicas Teste A / Teste B.
4. Ensaiar backup + restore (`docs/BACKUP.md`) e marcar a data em `/plataforma/prontidao`.
5. Só então: paginar busca/agenda/prontuário e autenticar signaling.

## 4. Checklist vs. os 40 pedidos

| # | Pedido | Situação |
|---|---|---|
| 1 | Não alterar o que funciona | Cumprido |
| 2 | Auditoria primeiro | Este documento |
| 3 | Staging | Runbook; ambiente ainda não existe na nuvem |
| 4 | Backup + restore testado | Runbook; restore **não** executado (precisa do painel Supabase) |
| 5 | Comparar contagens | Integridade já existia; saúde/prontidão mostram |
| 6–9 | Performance / lazy / busca / agenda | Auditados; **não** reescritos no painel médico |
| 10 | Duplo clique | Check-in, fechamento, repasse, regra, clínica |
| 11–16 | Financeiro transacional / avisos / histórico / conferência / sem duplicar | Eventos persistidos + check-in idempotente + preview com avisos + conferência |
| 17–18 | PDF A4 / não travar | PDF de fechamento paginado + “Gerando…” |
| 19–20 | Simplificar atendente/médico | **Não** refeito o painel médico; check-in continua simples |
| 21–23 | Gestora / alertas / saúde | Home da clínica + `/plataforma/saude` |
| 24–26 | Isolamento / carga / duas clínicas | Teste automático A/B; carga só em staging |
| 27–29 | Mobile / rede ruim / auto-save evolução | Mobile das telas novas; auto-save **não** no prontuário |
| 30–35 | Confirmações / erros humanos / logs / status / auditoria / dashboard enxuto | Parcial (clínica + plataforma) |
| 36 | Sem IA agora | Nenhuma IA nova |
| 37–39 | PILOT / métricas / prontidão | Status `pilot` + métricas + checklist |
| 40 | Relatório final | Este arquivo |
