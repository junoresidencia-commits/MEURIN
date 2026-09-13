# Backup e restauração

O Meu Rim em produção usa **Supabase/Postgres**. O arquivo `data/db.json` só existe no modo demo local e **não** é o backup de produção.

## O que o app já mede

- Contagens em `/plataforma/integridade` e `/plataforma/saude` (`platform_integrity_snapshots`).
- Isso **não** substitui dump do Postgres. Se o banco cair, as contagens não restauram paciente nenhum.

## Backup confiável (Supabase)

No painel do projeto de produção:

1. **Settings → Database → Backups** (PITR se o plano permitir, ou backups diários).
2. Anotar: último backup, status, tamanho estimado.
3. Guardar também um dump manual antes de qualquer SQL novo:

```bash
# no seu computador, com a connection string de produção (nunca commitar)
pg_dump "$PRODUCTION_DATABASE_URL" --format=custom --file=meurim-prod-$(date +%Y%m%d).dump
```

## Restore ensaiado (obrigatório antes do piloto)

1. Criar banco **staging** vazio.
2. Restaurar o dump (ou um subset) **só no staging**:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$STAGING_DATABASE_URL" meurim-prod-YYYYMMDD.dump
```

3. Comparar contagens (pacientes, evoluções, documentos, exames, consultas).
   Se alguma quantidade clínica **diminuir**: parar. Não aplicar o mesmo SQL em produção.
4. Entrar com um médico de **teste** no app apontado ao staging. Não usar o login real contra o dump se a URL ainda for a de produção.
5. Se o restore fechou e as contagens bateram, gravar a data em `BACKUP_RESTORE_TESTED_AT` (ISO) no ambiente. A tela `/plataforma/prontidao` passa a marcar Backup/Restore.

## O que esta entrega NÃO faz

Não dispara `pg_dump` da Vercel (sem socket Postgres na app) e não apaga/restaura o banco de produção. O botão de “restaurar” dentro do produto seria perigoso demais para as primeiras clínicas.
