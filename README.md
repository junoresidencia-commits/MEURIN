# Meu Rim — Nefrologia online para todo o Brasil

Plataforma própria de teleconsulta de nefrologia para quem a distância, a fila ou a pressa atrapalham — interior, capital ou agenda apertada.

## A ideia

Atendimento presencial ainda deixa muita gente para trás. Em várias cidades não há nefrologista perto. Em outras, a espera é longa. A Meu Rim junta **agenda + pagamento na conta do médico + sala de vídeo própria**, sem depender de Zoom pago.

## Fluxo do paciente

1. Escolhe o nefrologista  
2. Vê horários (os mais próximos primeiro se estiver com pressa)  
3. Informa cidade, motivo e dados  
4. Paga (Pix, cartão ou boleto — demo)  
5. Recebe e-mail + link da sala Meu Rim  
6. Pode mandar o link no WhatsApp e compartilhar a plataforma  

## Fluxo do médico

1. Cadastro com CRM, Pix/conta e valor  
2. Define dias de atendimento  
3. Paciente só libera a sala depois de pagar  
4. Valor estimado na conta do médico (demo: 95%)  

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Contas demo

- `carlos@meurim.com` / `medico123`  
- `ana@meurim.com` / `medico123`  

## Produção

- Pagamentos reais: Stripe Connect ou Mercado Pago Split  
- E-mail: Resend / SendGrid  
- Banco: Postgres (ex. Supabase) no lugar de `data/db.json`  
- Vídeo: TURN / LiveKit para redes instáveis do interior  

## Legado

Conteúdo educativo estático anterior em `legacy/index.html`. Calculadora CKD-EPI em `/educacao`.
