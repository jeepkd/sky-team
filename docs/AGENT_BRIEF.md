# Sky Team Digital — Agent Kickoff Brief

You are a coding agent implementing a browser-based multiplayer board game.
Read the files below **in full before writing any code**, then execute tasks
in order as described.

## Read these files first (in this order)

1. `docs/IMPLEMENTATION_PLAN.md` — your complete specification. Every task,
   file path, function signature, and acceptance criterion is there.
2. `src/lib/supabase.ts` — the Supabase client + `getClientId()`.
3. `src/types.ts` — shared `Role`, `Player`, `Session` types.
4. `supabase/migrations/001_initial_schema.sql` — what's already in the DB.

## What's already done — do not redo

- Project scaffold: `package.json`, Vite/TS/Tailwind config, `index.html`.
- `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts`.
- `src/lib/supabase.ts`, `src/types.ts` (already created, read them).
- `src/App.tsx` — currently a setup-verification screen. **Task P1.4 replaces it.**
- Migration `001` already applied in Supabase Studio. Tables `rooms`, `games`,
  `players` exist with permissive RLS.
- `pnpm install` already run. `pnpm dev` boots clean.

## Hard rules (non-negotiable — read §0 of the plan)

- One task at a time. Verify before moving on.
- Pure engine code (`src/lib/game/`) must have zero React/Supabase imports.
- Do not invent Sky Team rulebook numbers — mark them `TODO_RULEBOOK` and ask.

## Start here

Begin with **task P1.1** (`src/lib/rooms.ts`).
Report: files changed · how verified · anything the user must run.
Then stop and wait for the user to confirm before starting P1.2.
