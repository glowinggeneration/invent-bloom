# Lovable Build Prompt: SMAIT

Paste the prompt below into Lovable after importing the accompanying codebase ZIP.

---

Continue this existing SMAIT repository. Treat the imported code as the source of truth. Do not scaffold a replacement app, flatten it into a client-only demo, or recreate screens from screenshots. Preserve existing working behavior and extend it in small, testable changes.

## Product and users

SMAIT is an authenticated communications-intelligence and campaign-operations workspace. Its operating loop is:

**Monitor -> Understand -> Decide -> Test -> Run -> Measure**

The primary users are communications leaders, analysts, campaign operators, and approved administrators. The product must help them understand monitored public conversation, test messages against a 100-persona panel, execute approved campaigns through authorised accounts, and produce defensible reports.

Keep product language concrete and institutional. Do not introduce generic SaaS marketing copy, novelty effects, or speculative features that do not support a real user, operational, governance, or compliance need.

## Non-negotiable source rules

1. Read `AGENTS.md` before making changes.
2. Apply `docs/build-standards/MASTER_RULES.md` to every change.
3. Use `docs/build-standards/BUILD_CHECKLIST.md` before release.
4. Keep `docs/build-standards/EXCEPTION_REGISTER.md` accurate. Do not claim that a known exception is resolved unless the control is implemented and verified.
5. Do not rewrite published Git history. This repository is connected to Lovable.
6. Never hand-edit `src/routeTree.gen.ts`. TanStack Router regenerates it during build.
7. Never commit `.env` or any secret. Use `.env.example` only as a variable-name reference.

## Existing stack to preserve

- TanStack Start and TanStack Router
- React 19 and TypeScript with strict checking
- Vite
- Tailwind CSS 4
- Radix UI and the existing shadcn-style primitives under `src/components/ui`
- TanStack Query for server-state loading and mutation handling
- Supabase authentication and database access
- Zod validation on server boundaries
- Recharts for analytical visualisation
- Motion for restrained state transitions, with reduced-motion support
- Vitest, ESLint, Prettier, and TypeScript validation

Do not migrate this project to Next.js, a different router, or a static Vite SPA. Do not add a second design system when an existing primitive can be extended.

## Architecture and data boundaries

- Keep protected business logic in authenticated server functions and server-only modules.
- Authorise every protected read and write on the server. Client-side visibility is not permission enforcement.
- Keep database changes in version-controlled files under `supabase/migrations`.
- Do not modify the production database directly.
- Use parameterised Supabase queries and existing ownership checks.
- Validate external inputs, uploads, URL parameters, webhook payloads, and structured AI outputs.
- Preserve real loading, empty, partial, error, success, and offline states.
- Do not replace live integrations with mock data. When a provider is not configured, show the existing honest configuration or unavailable state.
- Do not invent provider balances, account readiness, mentions, campaign results, AI scores, or sync progress.
- Keep provider secrets server-side. Never expose service-role credentials, account cookies, proxy credentials, or API keys to the client bundle.
- Preserve campaign compliance safeguards described in `README.md`, including the separation of monitoring and execution and the retirement of prohibited fleet-wide engagement patterns.

## Interface system

Preserve the current visual language:

- Warm neutral page background and white card surfaces
- SMAIT pink as the main action and selected-state colour
- Green for success/readiness, amber for caution, and red for failure or material risk
- Strong black headings, muted supporting text, restrained borders and shadows
- Dense but readable desktop command layouts with responsive single-column fallbacks
- One visually dominant action per decision area
- Clear focus indicators, keyboard access, persistent form labels, adequate touch targets, and WCAG 2.2 AA intent
- Motion only when it explains a state change. Respect `prefers-reduced-motion`.
- Content-shaped skeletons for data-driven screens. Use spinners only for short actions whose final layout is unknown.

Use the existing shared components instead of copying page-specific variants. Important reusable layers include:

- `src/components/ui`
- `src/components/base`
- `src/components/core`
- `src/components/smait`
- `src/components/ui-kit.tsx`
- `src/components/command-layout.tsx`

## Adopted UI patterns

The repository already incorporates the supplied UI component collections in product-appropriate places. Preserve and reuse these implementations:

- Responsive segmented controls and page tabs, including native-select fallbacks on narrow screens
- Progressive blur at scroll boundaries where it improves depth and content continuity
- Animated numbers, progress indicators, loading indicators, and stateful inline actions
- Accessible tooltips and compact utility buttons for secondary actions
- Account/profile cards, account dropdowns, profile editing, and the profile plan section
- Disclosures and accordion patterns for help, governance, changelog, and secondary detail
- File-upload progress for real media workflows
- Compact pie, activity gauge, area, radar, sentiment, trend, and topic charts for measured data
- Filterable, sortable, paginated tables for operational datasets
- Saved-investigation toggles backed by browser persistence
- Pinned tests in Archive backed by the existing thread update server function
- Copy controls that show pending and confirmed states only after the clipboard action succeeds
- Linked-account status popovers that use real readiness counts and real query refresh state
- Campaign tone sliders, scheduling controls, slot selection, tags, step progression, summaries, and live previews

Do not add the component-collection marketing sections, mega navigation, testimonials, infrastructure maps, or decorative bento layouts to authenticated operational screens. They may be considered only if a separate public marketing site is explicitly requested.

## Core journeys to preserve

Validate these routes after any navigation, authentication, server-function, or shared-layout change:

- `/overview`
- `/mentions`
- `/brief`
- `/crisis`
- `/new`
- `/testing`
- `/compare`
- `/personas`
- `/campaigns`
- `/campaign-manager`
- `/campaign-proof`
- `/preflight`
- `/performance`
- `/reports`
- `/reports/builder`
- `/watchlist`
- `/decisions`
- `/archive`
- `/linked-accounts`
- `/profile`
- `/help`
- `/governance`
- `/changelog`
- Admin account, activity, profile, and health surfaces for authorised administrators

Preserve the existing responsive sidebar, top navigation, global search, notification affordance, theme behavior, account menu, idle-session guard, and route-level access checks.

## Environment setup

Configure deployment secrets in Lovable Cloud using the names in `.env.example`. The imported ZIP intentionally excludes local `.env` files. At minimum, configure the appropriate Supabase client and server values for the target environment. Configure AI and data-provider credentials only for integrations that are enabled.

Use separate development, staging, and production credentials. If a credential has ever been exposed, rotate it rather than merely deleting it from source.

## Change process

For every requested change:

1. Inspect the current route, shared primitives, server functions, database tables, and tests before editing.
2. State the user or operational need the change serves.
3. Identify whether the change affects authentication, permissions, migrations, provider execution, AI output, or irreversible data.
4. Reuse or extend an existing shared primitive.
5. Keep mutations pending-safe and prevent duplicate submissions.
6. Use optimistic rendering only for predictable and reversible actions, with rollback or reconciliation on failure.
7. Add or update tests for business rules and failure paths.
8. Run focused checks, then the full validation sequence.
9. Record any rule that cannot be met in the exception register with reason, risk, temporary control, owner, deadline, and approval.

## Validation commands

Run from the project root:

```sh
bun install
bun run validate
```

The imported project may document inherited lint debt in the exception register. Do not add new lint failures. Format and lint every changed file even when the historical whole-project baseline is not yet clean.

## Release acceptance

Before publishing:

- Apply all pending Supabase migrations in order in the intended environment.
- Confirm authenticated and admin route protection on the server.
- Confirm no secret or local `.env` file is present in source or build output.
- Confirm loading, empty, error, offline, and success states on modified data screens.
- Confirm keyboard operation, focus visibility, labels, announcements, contrast, zoom, and reduced motion for modified interactions.
- Confirm provider-unavailable states are honest and actionable.
- Confirm there are no browser-console errors, broken requests, or avoidable warnings on core journeys.
- Confirm tests, production build, TypeScript, and changed-file lint pass.
- Verify a rollback path and assign the post-deployment check.

When uncertain, preserve the existing implementation, explain the risk, and ask for the smallest decision needed. Do not make destructive migrations, weaken permissions, bypass compliance controls, or replace real behavior with a polished mock.

---

The imported repository is the complete implementation baseline. Continue from it rather than generating a new design concept.
