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

### Scaffold & config
- `package.json`, Vite/TS/Tailwind config, `index.html`.
- `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts`.

### Phase 1 — Lobby (COMPLETE)
- **P1.1** `src/lib/rooms.ts` — `generateRoomCode`, `createRoom`, `joinRoom`, `fetchPlayers`.
- **P1.2** `src/hooks/useSession.ts` — `useSession()` with localStorage persistence.
- **P1.3** `src/hooks/usePresence.ts` — `usePresence(gameId, role, clientId)` → `{ online }`.
- **P1.4** Lobby UI: `src/components/lobby/Lobby.tsx`, `CreateRoomForm.tsx`, `JoinRoomForm.tsx`,
  `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/App.tsx` (rewritten).
- **P1.5** `src/components/room/RoomScreen.tsx` + `SeatCard.tsx` — live presence, realtime
  seat sync, copy-invite-link, leave button, auto-join from `?room=CODE` URL param.
- **`src/types.ts`** — `Role`, `ROLES`, `Player`, `Session`.

### Database (Supabase project `yigwykzdovwscjcvzyvv`)
- Migration `001_initial_schema.sql` applied. Tables `rooms`, `games`, `players` exist.
- Permissive RLS policies (`phase1_open_*`) created via Management API.
- `GRANT ALL ON rooms, games, players TO anon, authenticated` applied.
- Dev server: `pnpm dev` → `http://localhost:5174/`.

### Known workarounds
- `usePresence` and `RoomScreen`'s realtime subscription both call `purgeChannel` before
  `supabase.channel()` to work around a React StrictMode + supabase-js deduplication bug
  (supabase-js ≥ 2.107 caches channels by topic; async `removeChannel` leaves stale entries).

## Hard rules (non-negotiable — read §0 of the plan)

- One task at a time. Verify before moving on.
- Pure engine code (`src/lib/game/`) must have zero React/Supabase imports.
- Do not invent Sky Team rulebook numbers — mark them `TODO_RULEBOOK` and ask.
- Never run Docker, `supabase start`, or `supabase functions serve`.
- Use the `@/` import alias throughout.

## Start here

Phase 1 is complete. Begin with **Phase 2, task P2.0** — transcribe rulebook values
into `src/lib/game/config.ts` and write engine tests (requires `vitest`).

Before starting P2.0, ask the user to confirm the Phase 1 exit criteria passed:
> *Two browser tabs joined the same room, both seats showed filled and green/connected,
> closing one tab flipped its dot to grey in the other.*

Report: files changed · how verified · anything the user must run.
Then stop and wait for the user to confirm before starting the next task.
