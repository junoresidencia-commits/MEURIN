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

## Amanhã (só contas reais)

1. Deploy Vercel  
2. Domínio + `NEXT_PUBLIC_APP_URL`  
3. Mercado Pago / Stripe  
4. Resend (e-mail)  
5. Postgres (Supabase)  
6. CRM/Pix reais dos colegas  

Detalhes em [`SETUP.md`](./SETUP.md) e [`.env.example`](./.env.example).

## Legado

`legacy/index.html` — site educativo estático anterior.
