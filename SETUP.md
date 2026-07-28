# Meu Rim — setup para amanhã

O app **já roda** em modo demonstração. Use esta lista só para ir ao ar de verdade.

## Hoje (já feito no código)

- [x] Landing + compartilhar
- [x] Cadastro/login médico + agenda
- [x] Agendamento paciente (pressa, cidade, motivo)
- [x] Pagamento simulado → libera sala
- [x] E-mail simulado no log
- [x] Sala WebRTC própria
- [x] Educação CKD-EPI
- [x] Termos / privacidade stub
- [x] Página `/amanha` com checklist

## Rodar local

```bash
npm install
cp .env.example .env.local   # opcional
npm run dev
```

http://localhost:3000

Demo: `carlos@meurim.com` / `medico123` (senha igual para os outros `@meurim.com`)

## Amanhã — na sua ordem

1. **Vercel** — Importar o repo GitHub → Deploy  
2. **Domínio** — apontar DNS → `NEXT_PUBLIC_APP_URL=https://seu-dominio`  
3. **Mercado Pago Split** ou **Stripe Connect** — chaves no Environment Variables  
4. **Resend** — API key + domínio de e-mail verificado  
5. **Supabase/Postgres** — trocar `data/db.json` (próximo passo de engenharia)  
6. **Médicos reais** — cadastrar CRM/Pix reais; remover demos  
7. **PJ** — quem fatura a taxa da plataforma  

## Variáveis (`.env.example`)

Veja o arquivo `.env.example` na raiz. Sem elas o demo funciona; com elas você liga produção.

## Contato do fluxo

Paciente paga → status `confirmed` → e-mail com `/consulta/[roomId]` → médico e paciente entram na mesma sala.
