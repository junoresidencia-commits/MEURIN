# Evolução futura: App Store e Google Play com Capacitor

O Meu Rim já é um PWA instalável. Quando quiser publicar como app nativo nas lojas,
o Capacitor empacota o mesmo projeto web em contêineres iOS/Android **sem reescrever a aplicação**.

> NÃO execute isto agora. Este é um roteiro para o futuro. Nenhuma migração destrutiva é necessária.

## Pré-requisitos
- Node LTS, Xcode (iOS) e Android Studio (Android).
- Conta Apple Developer (iOS) e Google Play Console (Android).

## Passo a passo (resumo)

1. Instalar Capacitor:
   ```bash
   npm i @capacitor/core @capacitor/cli
   npx cap init "Meu Rim" app.meurim --web-dir=out
   ```
   Observação: Next.js com App Router e rotas de servidor não gera `out/` estático.
   Estratégia recomendada: apontar o app nativo para a URL de produção (Vercel) via
   `server.url` no `capacitor.config.ts` (webview do site), mantendo push/UX nativos.

2. Adicionar plataformas:
   ```bash
   npx cap add ios
   npx cap add android
   ```

3. Push nativo:
   - iOS: APNs (certificado/keys no Apple Developer) + `@capacitor/push-notifications`.
   - Android: Firebase Cloud Messaging (google-services.json) + `@capacitor/push-notifications`.
   - No backend, o mesmo ponto `sendNotification()` (`src/lib/notify.ts`) deve ganhar um
     "canal nativo": salvar o token nativo em `user_devices` (platform ios/android) e
     enviar via APNs/FCM além do Web Push. A estrutura de `user_devices` já prevê `platform` e `push_token`.

4. Ícones e splash:
   ```bash
   npm i -D @capacitor/assets
   npx capacitor-assets generate   # usa public/icons como base
   ```

5. Build e abrir IDEs:
   ```bash
   npx cap sync
   npx cap open ios       # Xcode
   npx cap open android   # Android Studio
   ```

6. Gerar builds de loja no Xcode (Archive) e Android Studio (AAB) e enviar para
   App Store Connect / Play Console.

## Deep links
As notificações já usam URLs internas (`/minhas-consultas?consulta=...`, `/medicos/agenda?consulta=...`).
No app nativo, configure Universal Links (iOS) e App Links (Android) para abrir essas rotas.

## O que NÃO muda
- Banco (Supabase), autenticação, agenda, prontuário, pagamentos e a central de notificações
  in-app continuam iguais. O Capacitor apenas adiciona o empacotamento nativo e o canal de push nativo.
