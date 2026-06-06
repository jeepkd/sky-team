# Sky Team Digital — Implementation Plan (Agent Execution Guide)

> This document is written to be executed by a coding agent, one task at a time.
> It assumes the architecture in `PLAN.html` but applies the **simplified build
> strategy** agreed with the user. Where the two conflict, **this document wins.**

---

## 0. How to use this document (READ FIRST — applies to every task)

**Operating rules (non-negotiable):**

1. **Do one task at a time, in order.** Each task ends with a **Verify** block.
   Perform the verification and report the result before starting the next task.
2. **Never run Docker.** Do not run `docker`, `docker compose`, `supabase start`,
   or `supabase functions serve`. When a step needs a command the user must run
   (installs, local Supabase, SQL in Studio, deploys), **write the command and the
   instructions, then stop and let the user run it.** Report what you need back.
3. **Do not modify `pnpm-workspace.yaml`.** Package builds are already approved
   there. Do not add/upgrade dependencies unless a task explicitly says to; if a
   task requires a new dependency, state it and let the user install it.
4. **Pinned versions stay pinned:** Vite 5, Tailwind 3, React 18, TypeScript 5.
   Node may resolve to 18 or 22 on this machine — code must work on both.
5. **Use the `@/` import alias** (configured in `vite.config.ts` + `tsconfig`).
6. **RLS stays permissive** (`phase1_open_*` policies) until Phase 6. Do not
   tighten policies mid-build — it will silently break the app.
7. **From Phase 2 on, the server is the trust boundary.** Game-logic validation
   and dice rolling happen in Edge Functions. The client may validate too (for UX)
   but the client is never authoritative.
8. **Hidden information:** opponent die *values* must never reach the other client —
   not in the UI and not in any realtime/REST payload. This is enforced starting
   Phase 4; until then dice are intentionally visible to simplify development.
9. **No premature libraries.** No router, no Zustand, no Framer Motion until a task
   introduces them. Use React `useState`/`useReducer` and conditional rendering.

**Code conventions:**

- Functional React components, one component per file, named exports for hooks/libs.
- Hooks live in `src/hooks/`, pure logic in `src/lib/`, components in `src/components/`.
- TypeScript `strict` is on (`noUnusedLocals`, `noUnusedParameters`). Keep it clean.
- Pure game logic (`src/lib/game/`) must have **no imports from React or Supabase** —
  it takes state in and returns state/decisions out, so it can run on client, in an
  Edge Function, and in tests unchanged.

**Per-task reporting format:**
> Files changed: … · How verified: … · Anything the user must run: …

---

## 1. Context

### 1.1 Stack
- **Frontend:** React 18 + TypeScript + Vite 5, Tailwind 3.
- **Backend:** Supabase — Postgres, Realtime, Edge Functions (Deno), Anonymous-less
  identity (localStorage `client_id` for now).
- **AI:** Anthropic Claude (`claude-sonnet-4-6`) via Edge Function, server-side key.
- **Hosting (later):** Vercel (frontend) + Supabase (backend).

### 1.2 Current state (already done — do not redo)
- Project scaffolded at repo root (`package.json`, `vite.config.ts`, `tsconfig.*`,
  `tailwind.config.ts`, `postcss.config.js`, `index.html`).
- `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts` exist.
- `src/lib/supabase.ts` exports `supabase` client + `getClientId()` (localStorage UUID).
- `src/App.tsx` is a **setup-verification screen** (3 status rows). It will be
  replaced in Phase 1 task P1.4.
- `src/types.ts` exists with `Role`, `ROLES`, `Player`, `Session`.
- `supabase/migrations/001_initial_schema.sql` created tables `rooms`, `games`,
  `players` with permissive RLS and realtime enabled. **Already run in Studio.**
- Setup gate verified: `pnpm dev` boots, all status rows green.

### 1.3 Target directory layout (built up across phases)
```
src/
  components/
    lobby/      Lobby, CreateRoomForm, JoinRoomForm
    room/       RoomScreen, SeatCard
    cockpit/    CockpitPanel + one component per module/slot group
    dice/       DiceHand, DieToken
    approach/   ApproachTrack
    chat/       ChatPanel, MessageList, MessageInput, AiThinking
    ui/         Button, Card, Banner, Toast
  hooks/        useSession, usePresence, useGameState, useMyDice, useChat
  lib/
    supabase.ts                (exists)
    api.ts                     edge-function callers (Phase 2+)
    rooms.ts                   create/join room (Phase 1, client-side)
    game/                      PURE engine — no React/Supabase imports
      types.ts                 GameState, Slot, Action, configs
      config.ts                AirportConfig + RulesConfig (rulebook values)
      slots.ts                 slot definitions + per-slot validators
      validate.ts              validatePlacement()
      resolve.ts               resolveRound(), checkEndConditions()
      index.ts                 re-exports
  types.ts      (exists) shared app types
supabase/
  migrations/   00X_*.sql
  functions/    create-room, join-room, roll-dice, place-die, resolve-round,
                reveal-round, ai-agent-tick   (Phase 2+)
docs/
  IMPLEMENTATION_PLAN.md  (this file)
```

---

## 2. Full target database schema (reference for all phases)

Each table notes the **phase** that introduces it. Migrations are additive and
numbered (`002_…`, `003_…`). Every new table gets RLS enabled + a permissive
`phaseX_open_<table>` policy and, if clients subscribe to it, is added to the
`supabase_realtime` publication.

| Table | Phase | Columns (type — notes) |
|---|---|---|
| `rooms` | 1 ✅ | `id uuid pk`, `code text unique`, `status text` (lobby/playing/done), `created_at` |
| `games` | 1 ✅ | `id uuid pk`, `room_id fk`, `status text` (lobby/active/victory/crashed/failed), `current_round int`, `current_phase text`, `created_at`, `updated_at`. **Phase 2 adds:** `state jsonb` (serialized `GameState`), `config jsonb` (AirportConfig+RulesConfig snapshot). |
| `players` | 1 ✅ | `id uuid pk`, `game_id fk`, `role text` (pilot/copilot), `client_id uuid`, `is_ai bool`, `connected bool`, `created_at`, `unique(game_id, role)` |
| `dice_rolls` | 2 | `id uuid pk`, `game_id fk`, `round int`, `player_role text`, `values int[]`, `remaining int[]`, `rolled_at`. **RLS in Phase 4:** readable only by owning role. |
| `placements` | 2 | `id uuid pk`, `game_id fk`, `round int`, `player_role text`, `slot_id text`, `die_value int`, `sequence int`, `revealed bool default false`, `placed_at` |
| `messages` | 5 | `id uuid pk`, `game_id fk`, `round int`, `player_role text`, `content text`, `msg_type text` (chat/ai_thought/system), `created_at` |
| `game_events` | 2 | `id uuid pk`, `game_id fk`, `event_type text`, `payload jsonb`, `created_at` — append-only realtime feed |

**Phase 4 RLS change (the only hidden-info enforcement at DB layer):**
- `dice_rolls` SELECT: `player_role` belongs to the requesting `client_id`.
- `placements` SELECT: `revealed = true OR player_role` belongs to requester.
- Until Phase 4 these stay permissive; the Edge Functions still avoid broadcasting
  hidden values (see §4).

---

## 3. Game engine specification (pure, data-driven)

> **Why data-driven:** exact Sky Team numeric thresholds (axis tilt limits per round,
> speed/altitude bands, brake force, traffic, approach-track length) must come from
> the **official rulebook**, not from this document. The engine reads them from
> `config.ts`. Task **P2.0** is to transcribe the real values; until then use clearly
> marked `TODO_RULEBOOK` placeholders and keep tests parameterized.

### 3.1 Core types — `src/lib/game/types.ts`
```ts
export type Role = 'pilot' | 'copilot';

// A slot is any place a die can go. Slots are defined in config, not hardcoded.
export interface SlotDef {
  id: string;                 // e.g. 'axis_pilot', 'engine_left', 'flaps_1'
  group: string;              // 'axis' | 'engine' | 'flaps' | 'gear' | 'radio' | 'brakes' | 'concentration'
  owner: Role | 'any';        // who may place here
  // pure predicate: may this die go here given current state? reason on failure
  validate(die: number, state: GameState, cfg: GameConfig): { ok: true } | { ok: false; reason: string };
}

export interface PlacedDie { slotId: string; role: Role; value: number; }

export interface GameState {
  round: number;
  phase: 'LOBBY' | 'PLACING' | 'REVEALING' | 'RESOLVING' | 'ENDED';
  turn: Role;                 // whose turn to place (alternates)
  approachPos: number;        // index along approach track
  altitude: number;
  speed: number;
  axisTilt: number;           // signed; out of band => crash
  flapsLevel: number;         // 0..4
  gearDeployed: boolean[];    // per gear slot
  brakeForce: number;
  traffic: number[];          // tokens on approach track (radio clears these)
  placed: PlacedDie[];        // this round's placements
  remaining: Record<Role, number[]>;  // dice not yet placed (server-truth)
  concentrationTokens: Record<Role, number>;
  coffeeUsed: Record<Role, boolean>;
  status: 'active' | 'victory' | 'crashed' | 'failed';
}

export interface PlaceAction { role: Role; slotId: string; dieValue: number; }
```

### 3.2 Config — `src/lib/game/config.ts`
```ts
export interface RulesConfig {
  dicePerPlayer: number;            // TODO_RULEBOOK (4)
  axisTiltLimitPerRound: number[];  // TODO_RULEBOOK
  speedBands: { altitude: number; minSpeed: number; maxSpeed: number }[]; // TODO_RULEBOOK
  flapsRequirements: number[];      // TODO_RULEBOOK (ascending)
  gearMinValue: number;             // TODO_RULEBOOK
  brakeMaxForce: number;            // TODO_RULEBOOK
  approachTrackLength: number;      // TODO_RULEBOOK
  startingConcentration: number;    // TODO_RULEBOOK
  // …add fields as P2.0 transcription reveals them
}
export interface AirportConfig { trafficTokens: number[]; /* TODO_RULEBOOK */ }
export interface GameConfig { rules: RulesConfig; airport: AirportConfig; }
export const DEFAULT_CONFIG: GameConfig = { /* TODO_RULEBOOK placeholders */ };
```

### 3.3 Pure functions
```ts
// slots.ts
export function buildSlots(cfg: GameConfig): SlotDef[];

// validate.ts
export function validatePlacement(
  state: GameState, action: PlaceAction, cfg: GameConfig
): { ok: true } | { ok: false; reason: string };
// checks: phase===PLACING, action.role===state.turn, die is in remaining[role],
// slot exists & empty, slot.owner allows role, slot.validate passes.

export function applyPlacement(
  state: GameState, action: PlaceAction, cfg: GameConfig
): GameState; // immutable; removes die from remaining, appends to placed, flips turn,
              // if all dice placed sets phase='REVEALING'.

// resolve.ts
export function resolveRound(
  state: GameState, cfg: GameConfig
): { state: GameState; events: GameEvent[] };  // applies module effects in fixed
              // dependency order, updates approachPos/altitude/speed/axisTilt/etc,
              // advances round or sets status, returns events for the feed.

export function checkEndConditions(
  state: GameState, cfg: GameConfig
): 'victory' | 'crashed' | 'failed' | null;
```

**Resolution order (fixed, encode as a list):** axis → engines/speed → radio(traffic)
→ flaps → gear → (landing phase) brakes. Exact effects per module: **TODO_RULEBOOK**,
transcribed in P2.0 alongside the constants.

---

## 4. Realtime & hidden-information strategy

- **One channel per game:** `game:{gameId}`. Clients subscribe to:
  - Postgres changes on `players` (seat ownership) and `games` (phase/state), and
  - `game_events` inserts (the action feed), all filtered by `game_id`.
- **Presence** (separate Supabase Realtime *presence* on the same channel name) tracks
  live connection — `{ role, clientId }`. Auto-cleans on tab close → drives the green
  "connected" dot without DB writes.
- **Hidden info (Phase 4):** the `place-die` Edge Function, when broadcasting a
  placement before reveal, emits `{ slotId, role, value: null }`. Values are written
  to `placements` but only surfaced after `reveal-round` sets `revealed=true` for the
  whole round atomically. `dice_rolls` are never broadcast at all — each client fetches
  its own via RLS-protected select.

---

## 5. Edge Function contracts (Phase 2+)

All are POST, receive `client_id` (header `x-client-id` or body) to authorize the
caller's role, validate with the **same `src/lib/game` engine**, and return JSON.
On invalid input return `{ error: string }` with HTTP 400.

| Function | Phase | Body | Returns | Side effects |
|---|---|---|---|---|
| `create-room` | 1→2* | `{ role? }` | `{ roomCode, gameId, role }` | insert room+game+player |
| `join-room` | 1→2* | `{ code, asAi? }` | `{ gameId, role }` | insert player (or rejoin) |
| `roll-dice` | 2 | `{ gameId }` | `{ ok }` | `crypto.getRandomValues` per player → `dice_rolls`; when both rolled, phase→PLACING |
| `place-die` | 2 | `{ gameId, slotId, dieValue }` | `{ ok }` or `{ error }` | validate via engine, insert placement, update remaining, broadcast (masked in P4); if all placed → trigger reveal-round |
| `reveal-round` | 2 | `{ gameId }` | `{ ok }` | atomic `UPDATE placements SET revealed=true WHERE round=…`; then resolve-round |
| `resolve-round` | 2 | `{ gameId }` | `{ status }` | engine `resolveRound`, persist `games.state`, emit `round_resolved`, advance/round-end |
| `ai-agent-tick` | 5 | `{ gameId }` | `{ ok }` | build context for AI role, call Claude with tools, validate+execute action, retry ≤2 |

*Phase 1 does create/join **client-side** in `src/lib/rooms.ts` for speed; Task **P2.1**
migrates them to Edge Functions once the server boundary matters.

---

## 6. PHASES & TASKS

> Legend per task: **Goal** · **Files** · **Spec** · **Depends** · **Verify**.
> A task is "done" only when its Verify passes in a real browser/terminal.

### PHASE 1 — Lobby
*Exit criteria: two browser tabs join the same room by code and see each other as connected.*

**P1.1 — Room create/join logic (client-side)**
- **Files:** `src/lib/rooms.ts`
- **Spec:**
  - `generateRoomCode(): string` — 4 chars from unambiguous alphabet
    `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no O/0/I/1).
  - `async createRoom(): Promise<Session>` — generate code (retry on unique
    violation, ≤5 tries), insert `rooms` (status `lobby`), `games`
    (status `lobby`, phase `LOBBY`), `players` (role `pilot`, `client_id` =
    `getClientId()`). Return `{ roomCode, gameId, role:'pilot' }`.
  - `async joinRoom(code: string): Promise<Session>` — uppercase+trim code; find
    room; find its game; load players. If `getClientId()` already owns a seat →
    return that seat (rejoin). Else take the first empty seat in `ROLES` order
    (insert player). If both seats owned by others → throw `Error('Room is full')`.
    If code not found → throw `Error('Room not found')`.
  - `async fetchPlayers(gameId): Promise<Player[]>`.
- **Depends:** existing schema + `supabase.ts` + `types.ts`.
- **Verify:** temporary console test or a throwaway button — call `createRoom()`,
  confirm a `rooms` row + `games` row + one `players` row appear in Studio.

**P1.2 — Session persistence hook**
- **Files:** `src/hooks/useSession.ts`
- **Spec:** `useSession()` returns
  `{ session: Session | null, setSession(s|null): void }`. Persist to
  `localStorage['sky-team:session']`; hydrate on mount; clearing sets null and
  removes the key. (This is the reconnection seed.)
- **Verify:** set a session, reload tab, confirm it rehydrates (log it).

**P1.3 — Presence hook**
- **Files:** `src/hooks/usePresence.ts`
- **Spec:** `usePresence(gameId, role, clientId)` joins Supabase Realtime channel
  `game:{gameId}`, tracks presence `{ role, clientId }`, and returns
  `{ online: Record<Role, boolean> }` derived from the presence state. Clean up
  (untrack + removeChannel) on unmount.
- **Depends:** P1.2.
- **Verify:** in P1.5.

**P1.4 — Lobby UI + app routing**
- **Files:** `src/components/lobby/Lobby.tsx`,
  `src/components/lobby/CreateRoomForm.tsx`,
  `src/components/lobby/JoinRoomForm.tsx`,
  `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`,
  rewrite `src/App.tsx`.
- **Spec:**
  - Replace the setup-verification `App` with view routing driven by `useSession`:
    no session → `<Lobby>`; has session → `<RoomScreen>` (P1.5).
  - `Lobby`: shows `CreateRoomForm` (a "Create room" button → `createRoom()` →
    `setSession`) and `JoinRoomForm` (code input → `joinRoom()` → `setSession`;
    show error text on throw).
  - `Button`/`Card`: minimal Tailwind presentational components reused later.
- **Depends:** P1.1, P1.2.
- **Verify:** `pnpm dev`; create a room → UI switches to room screen; the code shows.

**P1.5 — Room screen with live presence**
- **Files:** `src/components/room/RoomScreen.tsx`, `src/components/room/SeatCard.tsx`
- **Spec:**
  - `RoomScreen` reads `session`, loads `fetchPlayers`, subscribes to `players`
    Postgres changes (filtered by `game_id`) to keep seats current, and uses
    `usePresence` for online dots. Renders a `SeatCard` for `pilot` and `copilot`:
    seat owned? you? online? Shows the room code with a copy button and a
    shareable URL `?room=CODE`. A "Leave" button clears the session.
  - On mount, if URL has `?room=CODE` and no session, auto-call `joinRoom`.
- **Depends:** P1.1–P1.4.
- **Verify (Phase 1 EXIT):** open two tabs; tab A creates room; copy link to tab B;
  both show **both seats filled and both green/connected**; closing tab B flips its
  dot to offline in tab A within a couple seconds.

---

### PHASE 2 — Core gameplay loop (dice visible)
*Exit criteria: two humans play a full game start→finish; dice are visible to both (hidden info comes in Phase 4).*

**P2.0 — Transcribe rulebook into config + write engine tests**
- **Files:** `src/lib/game/config.ts`, `src/lib/game/__tests__/*` (and add `vitest`
  — state the dependency for the user to install).
- **Spec:** Fill every `TODO_RULEBOOK` in `RulesConfig`/`AirportConfig` with the
  official base-game values. Write table-driven tests for each module's validator
  and for `resolveRound` on a couple of known scenarios.
- **Verify:** **user confirms the numbers against the rulebook**, then `pnpm test`
  passes. (Do not invent values — if unknown, ask the user.)

**P2.1 — Engine implementation**
- **Files:** `src/lib/game/{types,slots,validate,resolve,index}.ts`
- **Spec:** Implement §3 signatures. Pure, no React/Supabase imports.
- **Depends:** P2.0.
- **Verify:** unit tests from P2.0 pass.

**P2.2 — Schema migration 002 (gameplay tables)**
- **Files:** `supabase/migrations/002_gameplay.sql`
- **Spec:** add `dice_rolls`, `placements`, `game_events`; add `games.state jsonb`,
  `games.config jsonb`; permissive RLS + realtime publication for the tables clients
  subscribe to. **User runs it in Studio.**
- **Verify:** tables visible in Studio; app still green.

**P2.3 — Edge Functions: create/join (migrate), roll, place, reveal, resolve**
- **Files:** `supabase/functions/{create-room,join-room,roll-dice,place-die,reveal-round,resolve-round}/index.ts`, shared engine import strategy for Deno (copy `src/lib/game` into a function-shared dir or use an import map — choose one and document it).
- **Spec:** Implement §5 contracts. Reuse the engine for all validation/resolution.
- **Depends:** P2.1, P2.2.
- **Verify:** call each function with `curl`/Studio; confirm DB rows + emitted events.
  (User deploys functions; agent provides the commands.)

**P2.4 — `useGameState` + `useMyDice` + `api.ts`**
- **Files:** `src/lib/api.ts`, `src/hooks/useGameState.ts`, `src/hooks/useMyDice.ts`
- **Spec:** `api.ts` wraps each Edge Function call. `useGameState(gameId)` subscribes
  to `games` + `game_events` and exposes the live `GameState`. `useMyDice(gameId,role)`
  loads/refreshes the caller's `dice_rolls.remaining`.
- **Verify:** logged state updates when functions run.

**P2.5 — Cockpit UI + dice placement**
- **Files:** `src/components/cockpit/CockpitPanel.tsx` (+ one component per slot
  group), `src/components/dice/DiceHand.tsx`, `src/components/dice/DieToken.tsx`,
  `src/components/approach/ApproachTrack.tsx`.
- **Spec:** render slots from `buildSlots(config)`; select a die in `DiceHand`, click a
  slot to place → `api.placeDie`. Disable invalid targets using client-side
  `validatePlacement` (UX only). Approach track shows plane position. **Dice values
  shown for both players this phase.**
- **Verify:** two tabs alternate placing all 8 dice; placements appear on both.

**P2.6 — Reveal, resolve, end-game screen**
- **Files:** `src/components/room/RoundResult.tsx`, `src/components/room/EndScreen.tsx`
- **Spec:** after all placed, server reveals+resolves; UI shows round result and
  advances; on `victory/crashed/failed` show `EndScreen`.
- **Verify (Phase 2 EXIT):** two humans complete a full game to a terminal state.

---

### PHASE 3 — Polish the core loop
*Exit criteria: the human-vs-human game feels complete and clear.*

- **P3.1 Round resolution animation** — sequential reveal of slots; plane moves on
  the approach track. *Verify:* visually smooth, no state desync.
- **P3.2 Concentration & Coffee tokens** — reroll / cancel mechanics wired through
  engine + an Edge Function action. *Verify:* tokens deplete; effects apply.
- **P3.3 Game summary** — `EndScreen` lists what happened / close calls. *Verify:*
  matches the event feed.
- **P3.4 Error/Toast UX** — `src/components/ui/Toast.tsx`, surface Edge Function
  errors. *Verify:* an intentional bad placement shows a friendly toast, no crash.

---

### PHASE 4 — Hidden information (the rules-critical step)
*Exit criteria: opponent dice values are invisible in the UI **and** absent from network payloads.*

- **P4.1 RLS tightening migration `003_hidden_info.sql`** — replace permissive
  `dice_rolls`/`placements` SELECT policies with the owner/revealed policies in §2.
  **User runs it.** *Verify:* a `select` as the opponent returns no values
  (test via two anon sessions or the `/audit-rls` approach).
- **P4.2 Mask broadcasts in `place-die`** — emit `value: null` pre-reveal. *Verify:*
  inspect the realtime payload in devtools — no opponent value present before reveal.
- **P4.3 UI masking** — opponent dice render face-down until `revealed`. Remove any
  hover-to-peek. *Verify:* opponent values never visible until the reveal animation.
- **P4.4 Placement-phase chat warning banner** — free text allowed, banner warns not
  to reveal values (honor system per design decisions). *Verify:* banner present.

---

### PHASE 5 — AI agent
*Exit criteria: a human plays a full game vs Claude at reasonable quality.*

- **P5.1 messages table migration `004_messages.sql`** + realtime. **User runs it.**
- **P5.2 `chat` feature** — `src/hooks/useChat.ts`,
  `src/components/chat/{ChatPanel,MessageList,MessageInput,AiThinking}.tsx`.
  *Verify:* two humans chat in realtime.
- **P5.3 `ai-agent-tick` Edge Function** — build context for the AI's role
  (respecting hidden info), call Claude with the `place_die` / `send_message` tool
  schema from `PLAN.html §8`, validate the returned action with the engine, retry ≤2
  with the error appended, fall back to a safe legal move. Server-side
  `ANTHROPIC_API_KEY` only. Per-room rate limit. *Verify:* with a saved game state,
  the function returns a **legal** action; never reveals its dice values.
- **P5.4 "Add AI opponent" in lobby** — join the empty seat as `is_ai=true`; trigger
  `ai-agent-tick` on phase/turn changes. *Verify (Phase 5 EXIT):* full solo game vs AI.
- **P5.5 AI persona + "thinking" stream** — friendly civilian pilot (per design
  decisions); show `reasoning` as an AI thought in chat. *Verify:* messages stay in
  character and never leak die values.

---

### PHASE 6 — Resilience & hardening
*Exit criteria: production-ready basics.*

- **P6.1 Reconnection** — rejoin mid-round from the persisted session / `?room=` link;
  restore full state. *Verify:* refresh mid-placement, state intact.
- **P6.2 Disconnect handling** — mark `connected=false` on presence leave; 10-min
  auto-forfeit via Supabase cron / scheduled Edge Function (per design decisions).
  *Verify:* simulated drop forfeits after timeout.
- **P6.3 Room expiry/cleanup job.** *Verify:* old rooms removed.
- **P6.4 RLS audit pass** — confirm no hidden-info leak across roles end-to-end.
  *Verify:* the `/audit-rls`-style query suite passes.
- **P6.5 Mobile-responsive cockpit** + **P6.6 sound cues** + **P6.7 perf**
  (memoize module renders, trim realtime payloads). *Verify:* usable on a phone
  viewport; no jank.

---

## 7. Definition of Done (whole project)
- A human can create/join a room by code or link and play a full base-game match to a
  terminal state, against another human **or** the Claude agent.
- Hidden information holds: opponent die values never appear in UI or network until
  reveal; RLS audit passes.
- All Edge Functions validate via the shared engine; dice are server-rolled.
- Reconnection works; stuck games resolve via timeout.
- Engine unit tests pass; rulebook values verified by the user.
