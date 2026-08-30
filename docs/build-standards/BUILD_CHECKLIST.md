# Build Checklist — Persona_Voices

Extracted from `MASTER_RULES.md` §14. Run through this before any release; unchecked items that can't be resolved go into `EXCEPTION_REGISTER.md`, not silently skipped.

## 14. Master Build Checklist

### Product and scope

- [ ] The ICP is complete and approved.
- [ ] The primary user, buyer and approver are identified.
- [ ] The product problem and measurable outcome are explicit.
- [ ] Every feature maps to a user, business, compliance or operational need.
- [ ] Out-of-scope users and functions are documented.
- [ ] Required data and prohibited data are defined.

### Architecture and configuration

- [ ] The architecture is as simple as the requirements allow.
- [ ] Module boundaries and ownership are clear.
- [ ] Business logic is separated from presentation logic.
- [ ] API keys and secrets are not hardcoded or exposed to the client.
- [ ] Development, staging and production use separate configuration.
- [ ] Secret scanning and dependency checks pass.
- [ ] Serverless functions are used only where their operating model fits.

### Interface and content

- [ ] Every data-driven screen has a content-shaped skeleton loader.
- [ ] Empty, partial, success and error states exist.
- [ ] Semantic colour tokens are consistent.
- [ ] Colour is not the only carrier of meaning.
- [ ] Redundant subtitles, cards, labels and decoration are removed.
- [ ] The primary action is visually clear.
- [ ] Generic AI-generated copy has been replaced with concrete language.
- [ ] A custom favicon, title, icon and sharing image are present.
- [ ] Logos, icons and simple illustrations use responsive SVG where suitable.
- [ ] Images have dimensions, compression and alternative text.
- [ ] Optimistic updates include pending, rollback and reconciliation behaviour.

### Accessibility

- [ ] The product targets WCAG 2.2 Level AA.
- [ ] Core journeys work with keyboard-only navigation.
- [ ] Focus order and focus indicators are correct.
- [ ] Forms have labels, instructions and associated errors.
- [ ] Contrast has been checked.
- [ ] Screen reader announcements cover dynamic changes.
- [ ] Zoom and text resizing do not break the interface.
- [ ] Reduced-motion preferences are respected.
- [ ] Automated and manual accessibility testing are complete.

### Authentication and security

- [ ] Passwords use a recognised one-way password-hashing function.
- [ ] Recoverable sensitive data uses appropriate encryption.
- [ ] Client and server input validation are implemented.
- [ ] Queries are parameterised.
- [ ] Session tokens are protected with secure cookie controls where applicable.
- [ ] Authentication and role checks occur on the server.
- [ ] Object-level ownership is verified on every protected operation.
- [ ] MFA is enabled for privileged accounts.
- [ ] OTP and verification flows expire, are single-use and are rate limited.
- [ ] Login and password-reset endpoints are rate limited.
- [ ] Passwords are checked against compromised-password data.
- [ ] Account recovery avoids account enumeration.
- [ ] Security headers, HTTPS and cross-origin restrictions are configured.
- [ ] User errors are actionable without revealing internal details.

### Database and backend

- [ ] Every schema change uses a version-controlled migration.
- [ ] Destructive changes have explicit approval and recovery plans.
- [ ] Migrations pass on production-like data.
- [ ] Locking, runtime, storage and compatibility have been measured.
- [ ] Constraints and transactions protect important invariants.
- [ ] Backup restoration has been tested.
- [ ] N+1 query candidates have been audited and measured.
- [ ] Important list endpoints use pagination.
- [ ] External calls use timeouts and bounded retries.
- [ ] State-changing retryable operations use idempotency controls.
- [ ] Duplicate and concurrent requests are tested.
- [ ] Edge cases and partial failures have defined behaviour.

### AI features

- [ ] Critical AI features have a tested provider fallback or degraded mode.
- [ ] Model outputs use validated schemas where structure matters.
- [ ] The selected model meets a measured quality target at controlled cost.
- [ ] Retrieval is separate from generation.
- [ ] Retrieved data is authorised before model access.
- [ ] Model tools are narrow and receive trusted context from the server.
- [ ] Consequential actions require suitable confirmation or approval.
- [ ] Streaming handles interruption, cancellation and incomplete output.
- [ ] Per-request and per-user token caps are enforced.
- [ ] Retry and failover costs are bounded.
- [ ] Model, token, latency, tool and fallback telemetry is recorded safely.

### Operations and release

- [ ] Logs, metrics and traces cover critical flows.
- [ ] Audit logs cover sensitive and consequential actions.
- [ ] Secrets and unnecessary personal data are redacted from telemetry.
- [ ] Alerts correspond to user impact and operational thresholds.
- [ ] Unit, integration, end-to-end and contract tests pass.
- [ ] Core journeys have been tested on representative devices and networks.
- [ ] Browser console and network errors are resolved.
- [ ] Deployment, health check and rollback steps are documented.
- [ ] The post-deployment verification is assigned to an owner.
