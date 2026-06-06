import { handleCors, json } from '../_shared/cors.ts';

// DEPRECATED: Concentration no longer "takes back" a die. Placing a die in a
// Concentration space now simply grants a Coffee token (handled in place-die /
// the engine). Coffee is spent at placement time to adjust a die ±1. Kept as a
// harmless no-op so older clients don't error.
Deno.serve((req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  return json({ ok: true, deprecated: true });
});
