import { handleCors, json } from '../_shared/cors.ts';

// DEPRECATED: rounds resolve immediately as dice are placed (see place-die and the
// engine's resolvePlacement/endOfRound). There is no separate batched resolve step.
// Kept as a harmless no-op so older clients don't error.
Deno.serve((req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  return json({ ok: true, deprecated: true });
});
