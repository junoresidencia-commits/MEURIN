# Meu Rim — Teleconsulta de nefrologia

Plataforma própria para consultas online de nefrologia: cadastro de médicos, agenda, pagamento para a conta do médico e sala de vídeo na própria aplicação.

## Fluxo do paciente

1. Escolhe o nefrologista  
2. Vê horários disponíveis  
3. Informa dados e paga (Pix, cartão ou boleto — demo)  
4. Recebe e-mail com link da sala  
5. Entra em `/consulta/[sala]` sem Zoom pago  

## Fluxo do médico

1. Cadastro com CRM, Pix/conta e valor da consulta  
2. Define dias de atendimento no painel  
3. Paciente só é liberado após o pagamento  
4. Valor estimado vai para a conta do médico (demo: 95%; taxa plataforma 5%)  

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Contas de demonstração

- `carlos@meurim.com` / `medico123`  
- `ana@meurim.com` / `medico123`  

## Produção (próximos passos)

- **Pagamentos reais:** Stripe Connect ou Mercado Pago Split para depósito na conta de cada médico  
- **E-mail:** Resend / SendGrid no lugar do log simulado  
- **Banco:** migrar `data/db.json` para Postgres (ex.: Supabase)  
- **Vídeo:** LiveKit self-hosted ou reforçar o WebRTC atual com TURN  

## Legado

O conteúdo educativo estático anterior está em `legacy/index.html`.
