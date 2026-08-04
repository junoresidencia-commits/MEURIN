# AGENTS.md

## Cursor Cloud specific instructions

**What this is:** `Meu Rim` — a Next.js 15 (App Router, React 19) nephrology telemedicine
demo. One service only: the Next.js app. Standard commands live in `package.json`
(`dev`, `build`, `start`, `lint`); setup notes are in `README.md` / `SETUP.md`.

### Running / testing
- Start the dev server with `npm run dev` (serves on `http://localhost:3000`).
  Use a background/tmux session; it does not exit on its own.
- Lint: `npm run lint`. Typecheck happens as part of `npm run build`.
- There is no automated test suite. Verify changes manually via the UI or by
  hitting the API routes (e.g. `curl http://localhost:3000/api/health`).

### Data store (non-obvious)
- By default the app runs in **demo mode** with a JSON file at `data/db.json`
  (the `data/` dir is gitignored and auto-created + seeded with 8 demo doctors on
  first read). No database is required to run or test the core flows.
- If both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, the
  store transparently switches to Supabase/Postgres (see `src/lib/store.ts` and
  `supabase/migrations/`). Leave them unset for local demo work.
- To reset demo data, stop the server and delete `data/db.json`; it re-seeds on
  next read.

### Core flow to sanity-check the app
Patient booking: `/agendar` → pick a doctor → pick a slot → enter name/email →
choose payment (Pix confirms instantly in demo) → redirected to
`/confirmacao/[id]`. Payment is simulated; the confirmation "email" is printed to
the dev server logs, and the booking becomes `confirmed` with a WebRTC room at
`/consulta/[roomId]`. Doctor demo login: `carlos@meurim.com` / `medico123`.
