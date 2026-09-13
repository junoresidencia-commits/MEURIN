# Staging — separado da produção

Produção (`https://meurim.vercel.app` + Supabase atual) guarda pacientes reais.
**Nunca** apontar o app de teste para `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` de produção.

## O que criar

1. **Projeto Supabase novo** (ex.: `meurim-staging`).
   - Rodar as migrations da pasta `supabase/migrations/` em ordem.
   - **Não** restaurar o dump de produção aqui até o restore ter sido ensaiado de propósito (ver `docs/BACKUP.md`).
   - Seed só com médicos/clínicas fictícios (Carlos demo, Clínica Teste A, Clínica Teste B).
2. **Projeto Vercel novo** ou Preview Deployment com env próprio:
   - `NEXT_PUBLIC_SUPABASE_URL` = URL do staging
   - `SUPABASE_SERVICE_ROLE_KEY` = service role do staging
   - `SESSION_SECRET` e `CRON_SECRET` **diferentes** dos de produção
   - `NEXT_PUBLIC_APP_URL` = URL do staging
   - `BACKUP_RESTORE_TESTED_AT` só depois do restore ensaiado
3. **Clínicas de teste**
   - Clínica Teste A e Clínica Teste B, status `pilot`
   - médicos, atendentes, pacientes, consultas e pagamentos sintéticos
   - validar isolamento com `scripts/test-clinic-isolation.ts` (sempre com env de produção **desligado**)

## O que nunca fazer

- Rodar script de carga (5.000 pacientes) no banco de produção.
- Apagar ou atualizar `doctors` / `patients` / notes / labs de produção para “ver se quebra”.
- Reusar o `SESSION_SECRET` de produção no staging (um cookie vazado serviria nos dois).

## Demo local (não é staging)

Sem as duas variáveis de Supabase, o app grava JSON em `data/` (gitignorado). Serve para testes de código. **Não** substitui um banco staging: a Vercel não persiste esse JSON.
