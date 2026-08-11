# Meu Rim — PWA, Notificações e Calendário

Este documento descreve o que foi implementado e como configurar/testar.

## O que foi implementado

- **PWA instalável**: `public/manifest.webmanifest`, ícones em `public/icons/`, service worker `public/sw.js`, `public/offline.html`, metadados/theme-color e `viewport-fit=cover` em `src/app/layout.tsx`, registro do SW em `src/components/PwaBootstrap.tsx`.
- **Camada única de notificações** (`src/lib/notify.ts`): `sendNotification({ userId, role, type, title, body, targetUrl, tag, ... })` grava a notificação in-app e dispara Web Push. Preparada para, no futuro, também acionar push nativo (iOS/Android) pelo mesmo ponto.
- **Armazenamento** (`src/lib/notifications-store.ts`): tabelas `user_devices` (assinaturas de push) e `notifications` (histórico + central), com fallback local em `data/` no modo sem Supabase.
- **Central de notificações**: sino `src/components/NotificationBell.tsx` (contador, marcar como lida, badge no ícone via `navigator.setAppBadge`), página `/notificacoes`, API `/api/notifications`.
- **Permissão sob demanda**: modal `src/components/EnableNotifications.tsx` ("Ativar lembretes"). Só pede a permissão nativa após o toque do usuário.
- **Assinatura de push**: `src/lib/push-client.ts` + APIs `/api/push/vapid`, `/api/push/subscribe`, `/api/push/unsubscribe`.
- **Disparos no ciclo da consulta**: pagamento (médico + paciente), confirmar, propor horário, remarcar (recria lembretes), cancelar, aceitar/recusar proposta, e consulta agendada pelo médico.
- **Lembretes 24h/2h**: `src/lib/reminders.ts` (`runReminderSweep`) + cron `/api/cron/reminders`. Fuso padrão `America/Bahia`.

  ### Agendamento do cron (importante — depende do plano da Vercel)
  - **Plano Hobby**: a Vercel só permite cron **1x/dia**. Um agendamento mais frequente (ex.: `*/15 * * * *`) **faz o deploy falhar**. Por isso o `vercel.json` usa `"0 11 * * *"` (08:00 America/Bahia) — uma varredura diária que já cobre bem os lembretes de 24h.
  - **Para lembretes de 2h com precisão** (ou no Hobby), use um **agendador externo grátis** chamando o endpoint a cada 15 min:
    - `GET https://SEU-DOMINIO/api/cron/reminders?key=SEU_CRON_SECRET`
    - Serviços: [cron-job.org](https://cron-job.org), EasyCron, ou um GitHub Action com `schedule`.
  - **Plano Pro/Enterprise**: pode trocar o `vercel.json` para `"*/15 * * * *"` e dispensar o agendador externo.
  - Fallback adicional já embutido: ao abrir a Agenda, o médico dispara `processReminders` (best-effort).
- **Calendário**: `/api/bookings/[id]/ics` (evento .ics com VALARM) e botão `src/components/AddToCalendar.tsx` (.ics + Google Agenda) em "Minhas consultas". Título do evento do médico configurável ("Consulta — Meu Rim" x "Consulta — Nome").
- **Configurações**: médico em `/medicos/configuracoes` (push, lembretes, calendário); paciente em `/paciente/dados` (ativar/desativar lembretes no aparelho).

## Privacidade (LGPD)

- As notificações **nunca** contêm dado clínico (diagnóstico, exame, medicação, TFGe etc.). Apenas data/hora, local e status.
- Notificações são assistenciais/operacionais. Não usar push para marketing sem consentimento específico.
- No calendário do médico, o padrão não expõe o nome do paciente ("Consulta — Meu Rim").

## Variáveis de ambiente necessárias

Veja `.env.example`. Para push funcionar de verdade:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # mesma chave pública
VAPID_SUBJECT=mailto:contato@seu-dominio.com.br
CRON_SECRET=...                    # protege /api/cron/reminders
```

Gere as chaves com: `npx web-push generate-vapid-keys`.
Rode a migration `supabase/migrations/20260810010000_notifications_pwa.sql` no Supabase.

## Como testar no iPhone (Safari)

1. Abra o site no Safari.
2. Compartilhar → **Adicionar à Tela de Início**. Abra o Meu Rim pelo ícone (modo standalone).
3. Faça login. Toque em **Ativar notificações** (modal ou em Configurações).
4. iOS 16.4+ é necessário para Web Push em PWA. As notificações só chegam com o app instalado na Tela de Início.
5. Agende/So confirme uma consulta para ver a notificação e o badge no ícone.

## Como testar no Android (Chrome)

1. Abra no Chrome. Aparecerá "Instalar aplicativo" (ou menu ⋮ → Instalar).
2. Faça login. Toque em **Ativar notificações**.
3. Confirme uma consulta (como médico) e veja a notificação chegar no aparelho, mesmo com o app fechado.
4. Toque na notificação → abre direto a consulta (deep link).
