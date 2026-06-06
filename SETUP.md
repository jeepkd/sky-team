# Dev Setup — Sky Team Digital

Two stages. Stage 1 gets the app talking to cloud Supabase with **no Docker**.
Stage 2 adds local Supabase + Edge Functions when Phase 2 starts.

---

## Stage 1 — Frontend + cloud Supabase (Phase 1)

### 1. Install dependencies

```bash
pnpm install
```

> Node 18.8 is installed here, which is fine for Vite 5 / Tailwind 3 (the
> versions pinned in `package.json`). No upgrade needed for Stage 1.

### 2. Create a Supabase project

1. Go to https://supabase.com → New project (free tier).
2. Wait for it to provision (~2 min).
3. Project Settings → API → copy the **Project URL** and **anon public key**.

### 3. Wire up env vars

```bash
cp .env.local.example .env.local
# then edit .env.local and paste the URL + anon key
```

### 4. Create the schema

In Supabase Studio → **SQL Editor**, paste the contents of
`supabase/migrations/001_initial_schema.sql` and run it.

### 5. Run the app

```bash
pnpm dev
```

Open http://localhost:5173.

### ✅ Verification gate

The page shows three rows, all 🟢:

- **React app** — rendered
- **Client identity** — a short id
- **Supabase connection** — `connected — 0 room(s)`

If the Supabase row is 🔴 saying the `rooms` table is missing, step 4 didn't run.
If it complains about env vars, step 3 is incomplete.

---

## Stage 2 — Local Supabase + Edge Functions (starts in Phase 2)

Not needed yet. When we add dice rolling / placement validation:

```bash
brew install supabase/tap/supabase
supabase init
supabase start            # local postgres + realtime + studio (Docker)
supabase functions serve  # edge functions with hot reload
```

`.env.local` then points at the local instance (`http://127.0.0.1:54321`)
instead of the cloud project.

Secrets that must stay server-side (never in the frontend):

```
# supabase/functions/.env
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```
