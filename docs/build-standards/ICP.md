# Ideal Customer Profile — Persona_Voices (FKF CommsIQ)

Per Application Build Master Rules §2. Filled in from what the product
already demonstrates; fields marked `TBD` need an explicit answer from the
product owner before new scope is added against them.

| Field | Answer |
| --- | --- |
| Customer segment | Sports federations and comparable public-facing organisations that need continuous media/social monitoring (current tenant: Football Kenya Federation). |
| Primary user | Communications team members monitoring mentions, sentiment and coverage day to day. |
| Core problem | Fragmented, manual tracking of what's being said across X, news and social platforms about the federation and its leadership, with no single source of truth for decisions made in response. |
| Trigger | A spike in mentions, a negative story, or a crisis moment that needs a fast, coordinated response. |
| Current alternative | Manual searching/monitoring across platforms, ad hoc screenshots, no persistent decision record — TBD to confirm with the customer. |
| Desired outcome | Faster detection of reputational risk/opportunity, a documented decision trail (Decision Log), and defensible campaign execution (Campaign Proof). |
| Buying criteria | TBD — likely: coverage breadth, response speed, auditability, cost. |
| Main objection | TBD — likely: trust in AI-drafted responses, data residency/compliance, cost of continuous monitoring. |
| Required integrations | X (Twitter), news providers (Newsdata), Apify-sourced social platforms, Supabase (data layer), Lovable AI gateway (generation). |
| Constraints | Kenyan/East African context (language, timezone `en-KE`), federation-branded reporting output, single-tenant-per-org data model (`org` column + `has_role`). |
| Exclusions | Not designed for: consumer-facing use, anonymous/public sign-up, multi-org data sharing across tenants. |

## Data rules

- **Data the product needs:** public mentions/posts, author handles and public profile metadata, sentiment/authority scoring inputs, campaign/reply records, decision-log entries.
- **Data the product must never collect:** end-user private messages, non-public account data, payment/financial details of monitored individuals, biometric data. (No such collection exists today — recorded here so it stays a deliberate boundary, not an oversight.)

## Feature acceptance rule (§2.3)

Every new feature must be traceable to one of: a primary-user need above, a
stated business objective, a compliance requirement, or an operational
control. If it isn't, don't build it — or record why it's an exception in
`EXCEPTION_REGISTER.md`.
