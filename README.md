# Meu Rim — Nefrologia online para todo o Brasil

Plataforma de teleconsulta: agenda + pagamento na conta do médico + sala de vídeo própria.

## Rodar agora

```bash
npm install
npm run dev
```

Abra http://localhost:3000

- Paciente: `/agendar`
- Médico demo: `carlos@meurim.com` / `medico123`
- Checklist do que falta para ir ao ar: **`/amanha`** e `SETUP.md`

## O que já funciona (demo)

- Cadastro de médicos, agenda, valor, Pix
- Agendamento com pressa / cidade / motivo
- Pagamento simulado → libera consulta
- E-mail simulado no terminal
- Sala WebRTC (`/consulta/...`)
- Minhas consultas por e-mail
- Educação CKD-EPI
- Termos / privacidade

## Próximo passo recomendado

**Supabase primeiro.** O código já está preparado para trocar
automaticamente `data/db.json` por Supabase/Postgres quando você preencher:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

A migration inicial está em:

```bash
supabase/migrations/20260728102000_init_meu_rim.sql
```

## Depois (contas reais)

1. Deploy Vercel  
2. Domínio + `NEXT_PUBLIC_APP_URL`  
3. Mercado Pago / Stripe  
4. Resend (e-mail)  
5. CRM/Pix reais dos colegas  

Detalhes em [`SETUP.md`](./SETUP.md) e [`.env.example`](./.env.example).

## Legado

`legacy/index.html` — site educativo estático anterior.
