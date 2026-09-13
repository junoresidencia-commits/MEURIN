# O que falta no seu computador / painel (3 → 7)

O código do piloto já está no repositório. Isto é o que **só você** faz no Supabase e na Vercel. Pode fazer depois; a ordem importa.

O projeto **meurim** na Vercel já tem `SESSION_SECRET`, `CRON_SECRET` e o Supabase de produção. **Não altere essas duas chaves do Supabase** nesse projeto.

## 3 — Staging (segundo site + segundo banco)

1. Supabase → **New project** → nome `meurim-staging` → senha nova guardada.
2. Settings → API: copie **Project URL** e **service_role**.
3. Vercel → **Add New → Project** → mesmo GitHub → nome `meurim-staging` (não `meurim`).
4. Env só deste projeto novo:
   - `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` = do **staging**
   - `SESSION_SECRET` e `CRON_SECRET` = **outros** valores, não os da produção
   - `NEXT_PUBLIC_APP_URL` = URL que a Vercel der
5. Deploy. Abra **só** essa URL. Se aparecerem os 222 pacientes com o banco ainda vazio, as chaves estão erradas.

## 4 — Restore ensaiado (só no banco staging)

1. Produção → SQL Editor (só leitura):

```sql
select
  (select count(*) from patients) as pacientes,
  (select count(*) from clinical_notes) as evolucoes,
  (select count(*) from documents) as documentos,
  (select count(*) from lab_results) as exames,
  (select count(*) from bookings) as consultas,
  (select count(*) from doctors) as medicos;
```

2. Database → Backups: se houver **Restore to a new project**, use. Senão, no Mac:

```bash
pg_dump "URI_PRODUCAO_5432" --format=custom --no-owner --file="$HOME/meurim-prod.dump"
pg_restore --clean --if-exists --no-owner --dbname="URI_STAGING" "$HOME/meurim-prod.dump"
```

3. Mesma query no **staging**. Se algum número clínico cair: **pare**.
4. Entre no site **staging**. No Vercel `meurim-staging` grave `BACKUP_RESTORE_TESTED_AT=2026-09-13` e `STAGING_URL`.

## 5 — SQL no staging (depois do restore)

No SQL Editor do **meurim-staging**, nesta ordem, os arquivos da pasta `supabase/migrations/`:

- `20260913080000_saas_plans_licenses.sql`
- `20260913090000_pilot_readiness.sql`
- `20260913091000_search_agenda_indexes.sql`

Não rode isso em produção até o passo 4 ter batido.

## 6 — Duas clínicas de teste

No `/plataforma` do **staging**: Clínica Teste A e B como **piloto**.  
Ou, com env de produção **desligado**:

```bash
env -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY \
  NODE_OPTIONS='--require ./scripts/shim-server-only.cjs' \
  npx tsx scripts/seed-staging-two-clinics.ts

env -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY \
  NODE_OPTIONS='--require ./scripts/shim-server-only.cjs' \
  npx tsx scripts/test-clinic-isolation.ts
```

## 7 — Produção: só olhar

`https://meurim.vercel.app/plataforma/saude` e `/plataforma/prontidao`.  
Pode criar `STAGING_URL` no projeto **meurim** (só a URL do teste). Não cole chaves do staging na produção.

Quando as duas clínicas reais forem entrar: **Marcar piloto** em `/plataforma/clinicas`.
