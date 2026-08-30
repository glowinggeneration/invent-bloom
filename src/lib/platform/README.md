# Platform scaffolding

Reusable architecture for Application Build Master Rules that don't yet
apply to a shipped feature. Each module here is self-contained, typed,
tested where the logic is pure, and **not wired into any route** — wire a
module in when the feature that needs it is actually built, rather than
re-inventing the pattern at that point.

The backing tables (`audit_log`, `rate_limit_hits`, `idempotency_keys`,
`ai_events`) are proposed in
`supabase/migrations/20260830190000_platform_scaffolding.sql` and must be
applied through the normal migration pipeline before these modules touch a
real database — see Master Rules §7.1. Until that migration is applied and
`supabase gen types` is re-run, the DB-touching calls below are cast at the
Supabase client boundary (documented inline) rather than fully typed
against the generated `Database` type.

| Module | Backs Master Rules | Status |
| --- | --- | --- |
| `audit-log.server.ts` | §7.1, §11.2 audit logging | Scaffold — not called from any route |
| `rate-limit.server.ts` | §6.5 rate limiting | Scaffold — not called from any route |
| `idempotency.server.ts` | §8.1 idempotency | Scaffold — not called from any route |
| `ai-provider.server.ts` | §9.1 multi-provider fallback, §9.6 streaming caveats | Scaffold — existing AI calls (`campaigns.server.ts`, `smait-ai.functions.ts`) call the gateway directly, not through this adapter |
| `ai-observability.server.ts` | §9.8 AI observability | Scaffold — not called from any route |
| `feature-flags.ts` | supports §13 gradual/flagged releases | Scaffold — no flags defined yet |

## How to wire a module in

1. Apply the migration (or the specific table it needs) in a real
   environment and run `supabase gen types` so the generated `Database`
   type includes the new table.
2. Replace the `as any` cast at the Supabase call site in the relevant
   module with the real generated row type.
3. Call the module from the feature's server function — e.g. wrap a
   campaign-send handler with `withIdempotencyKey(...)`, or call
   `logAuditEvent(...)` after a role change.
4. Add a test for the new call site's behaviour (success, duplicate/retry,
   failure) — the module's own unit tests only cover its internal logic.
5. Remove the corresponding row from
   `docs/build-standards/EXCEPTION_REGISTER.md` once it's live.
