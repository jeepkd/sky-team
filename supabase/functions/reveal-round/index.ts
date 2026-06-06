import { handleCors, json } from '../_shared/cors.ts';

// DEPRECATED: placements are now public and resolve immediately as each die is
// placed (see place-die). There is no separate reveal step. This endpoint is kept
// as a harmless no-op so older clients don't error.
Deno.serve((req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  return json({ ok: true, deprecated: true });
});
