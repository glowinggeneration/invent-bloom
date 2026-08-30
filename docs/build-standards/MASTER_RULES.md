# Application Build Master Rules

**Version:** 1.0  
**Issued:** 30 August 2026  
**Status:** Mandatory standard for every website, application and AI-enabled product

## 1. Purpose

This document is the default build standard for every digital product. It governs product definition, interface design, accessibility, security, databases, APIs, AI features, performance, testing, deployment and operations.

These rules apply to prototypes, internal tools, client platforms and production systems. A prototype may reduce scope, but it may not remove controls that protect user data, authentication, permissions or database integrity.

### Rule language

- **MUST** means the requirement is mandatory.
- **SHOULD** means the requirement is expected unless a documented reason justifies an exception.
- **MAY** means the requirement is optional and depends on the product.

### Operating principle

Build for clarity, reversibility and controlled failure. The system must remain understandable when it works, diagnosable when it fails and recoverable when a change goes wrong.

## 2. Product Definition and ICP

No interface or database should be built before the product has a defined Ideal Customer Profile, or ICP.

### 2.1 Required ICP

Every project MUST define:

- The primary customer or organisation.
- The primary user inside that customer group.
- The specific problem being solved.
- The event or pressure that causes the user to seek a solution.
- The current workaround and why it is inadequate.
- The measurable result the product must create.
- The buyer, user and approver when they are different people.
- The user's technical ability, device conditions and accessibility needs.
- The data the product needs and the data it must never collect.
- The users and use cases that are deliberately out of scope.

### 2.2 ICP template

Complete this before implementation:

| Field | Required answer |
| --- | --- |
| Customer segment | Who pays for or owns the solution? |
| Primary user | Who uses it most often? |
| Core problem | What recurring problem must disappear? |
| Trigger | What makes the problem urgent enough to act on? |
| Current alternative | How is the problem handled today? |
| Desired outcome | What measurable change proves value? |
| Buying criteria | What determines approval or rejection? |
| Main objection | What is most likely to prevent adoption? |
| Required integrations | Which systems must connect? |
| Constraints | Budget, regulation, devices, geography and bandwidth |
| Exclusions | Who or what is the product not designed for? |

### 2.3 Product acceptance rule

Every feature MUST connect to at least one user need, business objective, compliance requirement or operational control. If the connection cannot be stated, the feature should not be built.

## 3. Architecture and Codebase Rules

### 3.1 Start simple

- New products SHOULD begin as a well-structured monolith unless scale, isolation or deployment requirements justify distributed services.
- Modules MUST have clear responsibilities and explicit boundaries.
- Shared logic MUST live in reusable services or utilities, not be copied across pages.
- Business logic MUST not be buried inside presentation components.
- Environment-specific settings MUST be configured outside source code.
- Dependencies MUST be deliberate, maintained and limited to what the product needs.
- Every architectural exception MUST be recorded with the reason, owner and review date.

### 3.2 Serverless and stateless functions

Serverless or stateless functions MAY be used for:

1. Event-driven, bursty or unpredictable workloads.
2. Thin API glue and backend-for-frontend logic.
3. Isolated components that must scale independently.

Early-stage applications SHOULD keep core business logic under one server unless the separation creates a clear operational advantage. Do not distribute the system merely because the platform makes it easy.

### 3.3 Configuration and secrets

- API keys, database credentials, signing secrets and private tokens MUST never be hardcoded.
- Secrets MUST not appear in client bundles, source control, logs, screenshots or error messages.
- Server-side secrets MUST come from a protected secrets manager or secured environment configuration.
- Separate credentials MUST be used for development, staging and production.
- Credentials MUST follow least privilege and have a defined rotation process.
- Secret scanning MUST run before release and in the delivery pipeline.
- A leaked secret MUST be revoked and replaced. Removing it from the latest commit is not sufficient.

## 4. Interface and Experience Rules

### 4.1 Skeleton loaders

Every data-driven screen MUST have a designed loading state.

- Skeletons MUST reflect the shape and position of the final content.
- Loading elements MUST preserve layout and reduce content movement.
- Large areas MUST not remain blank before content appears.
- Spinners SHOULD be limited to short actions where the final layout is unknown.
- Loading, empty, partial, success and failure states MUST all be designed.

### 4.2 Semantic colours

Colour MUST communicate consistent meaning across the product.

Define reusable tokens for:

- Primary and secondary actions.
- Success, warning, error and information.
- Selected, focused, disabled and inactive states.
- Text, borders, backgrounds and surfaces.
- Light and dark themes when both are supported.

Brand colours establish identity. Semantic colours establish meaning. A colour must not change meaning between screens, and colour MUST never be the only way information is communicated.

### 4.3 Remove unnecessary clutter

Every visible element MUST earn its place.

- Do not add explanatory paragraphs beneath headings that already explain the page.
- Do not add generic subheadings beneath every title.
- Remove repeated labels, decorative badges and redundant cards.
- Use gradients, shadows, borders and rounded containers with restraint.
- Use whitespace, typography and alignment to create hierarchy.
- Keep one primary action visually dominant within each decision area.
- If removing an element does not reduce understanding or function, remove it.

### 4.4 Avoid the generic AI-generated appearance

- Do not default to purple and blue gradients unless the brand system requires them.
- Do not use generic phrases such as "powerful yet intuitive" or "streamline your workflow" without concrete meaning.
- Product copy MUST state what the product does, for whom and with what result.
- Every project MUST have a custom favicon, application icon, page title and sharing image.
- Browser developer tools MUST show no unresolved errors, failed requests or avoidable warnings before release.
- Empty screens, abrupt content appearance and default framework assets MUST be replaced with designed states.

### 4.5 SVG and image rules

- Logos, icons, diagrams and simple illustrations SHOULD be SVG by default.
- SVG files MUST use a valid `viewBox`, scale responsively and include accessible names when meaningful.
- Decorative SVGs MUST be hidden from assistive technology.
- Untrusted SVG markup MUST be sanitised before rendering.
- Photographs and complex raster artwork SHOULD use appropriately compressed AVIF, WebP, PNG or JPEG files instead of being forced into SVG.
- Images MUST declare dimensions or aspect ratios to prevent layout movement.
- Meaningful images MUST have useful alternative text.

### 4.6 Optimistic rendering

Use optimistic rendering where an action is predictable, reversible and likely to succeed.

- Update the interface immediately after the user acts.
- Send the operation to the backend in the background.
- Mark the optimistic state as pending when uncertainty matters.
- Confirm the state after server success.
- Roll back or reconcile the interface if the operation fails.
- Prevent duplicate submissions while the request is unresolved.
- Do not use optimistic rendering for irreversible, high-risk or legally significant actions without an explicit confirmation and recovery design.

Typical candidates include likes, follows, status changes, item reordering, lightweight edits and adding an item to a list. Payments, account deletion and permission changes require stricter handling.

## 5. Accessibility Standard

Every product MUST target WCAG 2.2 Level AA.

### 5.1 Required controls

- Use semantic HTML before adding ARIA.
- All functions MUST work with a keyboard.
- Focus indicators MUST be visible and consistent.
- Focus order MUST follow the visual and logical order.
- Form fields MUST have persistent labels and clear instructions.
- Errors MUST identify the affected field and explain how to correct it.
- Text and essential interface elements MUST meet required contrast levels.
- Touch targets MUST be large enough and separated sufficiently.
- Meaning MUST not depend on colour, sound, position or animation alone.
- Screen reader announcements MUST cover important dynamic changes.
- Browser zoom and text resizing MUST not break content or functions.
- Motion MUST respect reduced-motion preferences.
- Video MUST include captions where speech conveys information.
- Authentication MUST not depend on unnecessary cognitive tests.

### 5.2 Accessibility verification

Automated testing MUST be combined with manual keyboard, screen reader, zoom and contrast checks. Passing an automated scanner alone does not establish accessibility.

## 6. Security and Privacy Rules

Security controls MUST exist on the server even when the interface also provides the same checks. The client improves usability. The server establishes trust.

### 6.1 Hashing and encryption

Hashing is a one-way transformation used to verify a value without storing the original value. It is not a method for recovering data later.

- Passwords MUST be stored using an established password-hashing function such as Argon2id, scrypt or an appropriately configured bcrypt implementation.
- Every password hash MUST use a unique salt through the selected password-hashing implementation.
- Passwords MUST never be stored as plain text or reversible encrypted text.
- General data that must later be recovered MUST use authenticated encryption, not hashing.
- Encryption keys MUST be stored separately from encrypted data and rotated through a controlled process.
- Sensitive fields, backups and transport channels MUST be protected according to the product's threat model.
- Custom cryptographic algorithms MUST never be invented.

### 6.2 Input validation

Every point that accepts user or external input MUST be audited.

- Validate on the client for immediate feedback.
- Validate again on the server before trust, storage or execution.
- Prefer allowlists, typed schemas and explicit size limits.
- Normalise input before validation where the format requires it.
- Use parameterised queries. Never build database queries by concatenating user input.
- Encode output for its destination context to reduce injection risk.
- Validate uploaded file type, size, name and content.
- Treat headers, cookies, URL parameters, webhooks and third-party API responses as untrusted input.
- Reject invalid input with a stable error code and an actionable message.

### 6.3 Sessions and authorisation

- Session tokens SHOULD be stored in Secure, HttpOnly and appropriate SameSite cookies rather than browser local storage.
- Session identifiers MUST be unpredictable, rotated after authentication and invalidated on logout or security-sensitive changes.
- Every protected request MUST be authorised on the server.
- Admin and role checks MUST never rely on client-side state alone.
- Permissions MUST default to denial and follow least privilege.
- Object ownership MUST be checked for every read and write to prevent cross-account access.
- Sensitive actions SHOULD require recent authentication.
- Cross-site request forgery protection MUST be implemented when the authentication design requires it.

### 6.4 Authentication and account recovery

- Multi-factor authentication SHOULD be offered and MUST be required for privileged accounts.
- Email or phone verification MUST be used where the product needs proof of control, but verification must not be represented as legal identity proof unless a proper identity process exists.
- One-time passwords MUST expire, be single-use and be rate limited.
- Login, signup, verification and password-reset endpoints MUST be rate limited.
- Password-reset tokens MUST be random, short-lived, single-use and stored securely.
- Login and recovery responses MUST avoid revealing whether an account exists.
- Passwords MUST support reasonable length and all normal characters without silent truncation.
- New passwords MUST be checked against known compromised and commonly used password lists.
- Arbitrary composition rules SHOULD not replace length, breach screening and rate limiting.
- Account recovery MUST invalidate or review existing sessions when risk warrants it.

### 6.5 Rate limiting and abuse controls

The backend MUST be audited for endpoints that can be abused, exhausted or brute forced.

Prioritise:

- Login, signup, password reset, OTP and verification.
- Search, exports, uploads and expensive reports.
- AI generation and token-heavy operations.
- Email, SMS and notification sending.
- Payment, order and state-changing endpoints.
- Public APIs, webhooks and scraping-sensitive routes.

Rate limits SHOULD consider user, account, IP address, device, route, cost and time window. The interface MUST recognise a rate-limit response, preserve the user's work where possible and explain when the action can be tried again.

### 6.6 Error messages

- User-facing errors MUST be specific enough to support recovery.
- Errors MUST include stable machine-readable codes for the interface and support team.
- Authentication errors MUST remain generic when specificity would enable account discovery.
- Stack traces, SQL messages, internal file paths, secrets and provider credentials MUST never reach users.
- Logs MAY contain deeper diagnostic context, but MUST redact secrets and unnecessary personal data.

### 6.7 Security headers and transport

- Production traffic MUST use HTTPS.
- Apply an appropriate Content Security Policy.
- Apply clickjacking, MIME-sniffing and referrer protections.
- Cookies MUST use secure attributes appropriate to their purpose.
- Cross-origin access MUST be restricted to known origins and required methods.
- Dependencies and container images MUST be scanned and patched through a defined process.

## 7. Database and Migration Rules

### 7.1 Migrations only

Never instruct an AI coding agent or developer to "just modify the database."

- Every schema change MUST be represented by a named, version-controlled migration.
- Migrations MUST be deterministic, reviewable and deployable through the normal release process.
- Application code and its required migration MUST ship in a compatible order.
- Manual production changes MUST be reserved for controlled incident procedures and documented afterward.

### 7.2 Dangerous changes

Treat the following as high risk:

- Dropping tables, columns, indexes or constraints.
- Deleting or rewriting large volumes of data.
- Changing column types or nullability.
- Renaming fields used by deployed code.
- Adding blocking constraints or indexes to large tables.
- Changing primary keys, foreign keys or ownership relationships.

High-risk changes MUST include a backup or recovery point, impact analysis, staged rollout, rollback or forward-fix plan and explicit approval.

### 7.3 Production-like testing

- Test migrations against production-like volume, shape and edge cases before production.
- Test with nulls, duplicates, legacy rows, long values, unusual encodings and partial relationships.
- Measure runtime, locks, memory and storage impact.
- Rehearse rollback or recovery.
- Verify application compatibility before, during and after the migration.
- Never assume a successful migration on an empty development database proves production safety.

### 7.4 Data integrity

- Use database constraints for invariants that must always hold.
- Use transactions for related writes that must succeed or fail together.
- Use foreign keys where referential integrity is required.
- Add indexes based on measured query patterns.
- Define retention and deletion rules for personal and operational data.
- Backups MUST be encrypted, monitored and periodically restored in a test environment.

## 8. API and Backend Rules

### 8.1 Idempotency

State-changing operations that may be retried MUST be designed to avoid duplicate effects.

- The client SHOULD generate one unique idempotency key for one user intent.
- The same key MUST be reused when retrying that intent.
- The server MUST store the key with the request fingerprint, status and result for a defined retention period.
- A repeated matching request SHOULD return the original result.
- A reused key with a different payload MUST be rejected.
- Concurrent requests using the same key MUST be handled atomically.

Idempotency is especially important for payments, orders, bookings, credits, messages and other operations where duplication causes harm. Do not reject every duplicate blindly when returning the original safe result provides a better contract.

### 8.2 API contracts

- Requests and responses MUST use documented schemas.
- Validation errors MUST identify invalid fields without exposing internal implementation.
- Error responses MUST use consistent HTTP statuses and stable application codes.
- Timeouts, retries and cancellation behaviour MUST be defined.
- Retries MUST use backoff and jitter where appropriate.
- Pagination MUST be used for unbounded collections.
- API versions or compatibility plans MUST exist for breaking changes.
- External calls MUST have timeouts and controlled failure handling.

### 8.3 N+1 query prevention

The backend MUST be audited for N+1 queries, where one query loads a collection and additional queries are executed separately for every item.

- Use joins, eager loading, batching or data-loader patterns where appropriate.
- Record query counts and latency for important endpoints.
- Test list views with realistic record counts.
- Do not solve every N+1 issue by loading excessive data. Select only what the response needs.

### 8.4 Edge cases

Every feature MUST define behaviour for:

- Empty and missing data.
- Duplicate submissions.
- Slow, failed and partial network responses.
- Concurrent edits and stale state.
- Expired sessions and changed permissions.
- Very large or very small values.
- Different languages, time zones, currencies and date boundaries where relevant.
- Third-party downtime and malformed provider responses.
- Refreshing, navigating away and retrying mid-operation.
- Mobile interruption and unreliable connectivity.

## 9. AI Feature Rules

AI features are probabilistic dependencies. They MUST be designed with stronger contracts, limits and failure handling than deterministic functions.

### 9.1 Multi-provider resilience

- Critical AI features SHOULD have a tested fallback provider or a non-AI degraded mode.
- Provider switching MUST occur behind an internal adapter, not throughout product code.
- Prompts, schemas and capability differences MUST be tested for every fallback.
- Failover MUST use bounded retries and must not create duplicate actions or uncontrolled cost.
- Users MUST receive a clear status when a provider is unavailable.

### 9.2 Structured outputs

- Use schema-constrained JSON when downstream code requires a predictable structure.
- Validate every model response before use.
- Reject or repair invalid responses through a bounded process.
- Do not parse critical actions from loosely formatted prose when a structured contract is available.
- Treat model output as untrusted input.

### 9.3 Principle of least intelligence

Use the least expensive model that reliably meets the feature's measured quality target.

1. Define a representative evaluation set.
2. Define the required success rate and failure severity.
3. Test candidate models from lower to higher cost.
4. Select the least expensive model that meets the target.
5. Re-run evaluations when prompts, tools, models or data change.

High-risk decisions MUST not be optimised for cost at the expense of required accuracy, review or safety.

### 9.4 Separate retrieval from generation

- Do not place the entire database or knowledge base in one prompt.
- Use retrieval tools to locate only relevant, authorised information.
- Enforce permissions before retrieved content reaches the model.
- Keep source identifiers so answers can be traced and verified.
- Define what happens when retrieval finds weak, conflicting or no evidence.
- Defend tool and retrieval pipelines against prompt injection and untrusted instructions in source content.

### 9.5 Reduce model cognitive load

- Inject trusted context such as the authenticated user ID on the server instead of asking the model to supply it.
- Expose small, clearly named tools with narrow schemas.
- Remove parameters the model does not need to choose.
- Separate planning, retrieval and mutation when the risk warrants it.
- Require confirmation before consequential external actions.

### 9.6 Token streaming

- Stream model output when progressive display materially improves perceived speed.
- Show a clear generating state and allow cancellation where supported.
- Handle stream interruption, malformed chunks and provider timeouts.
- Do not treat partially streamed JSON as complete data.
- Buffer or validate structured output before executing actions based on it.
- Record time to first token and total completion time.

### 9.7 Token caps and cost controls

- Define per-request input and output token limits.
- Define per-user and per-workspace daily or monthly usage caps.
- Apply stricter limits to anonymous and trial users.
- Warn users before they reach a cap.
- Stop requests safely when a hard limit is reached.
- Allow controlled administrative overrides with an audit record.
- Track cost by feature, model, user and workspace.
- Prevent retries and fallback chains from multiplying cost without limit.

### 9.8 AI observability and auditability

Record, with appropriate privacy controls:

- Provider, model and model version where available.
- Prompt or template version.
- Tool calls and outcomes.
- Retrieval source identifiers.
- Input and output token usage.
- Latency, retries, fallback and failure reason.
- User, workspace, request and correlation identifiers.
- Human approval and final external action.

Do not log secrets or unnecessary sensitive prompt content. Establish retention and access rules for AI logs.

## 10. Performance and Reliability Rules

- Define performance budgets for key pages and API routes.
- Prevent avoidable layout movement by reserving space for content and media.
- Lazy-load non-critical code and media without delaying primary tasks.
- Use caching with explicit invalidation and ownership rules.
- Compress assets and responses appropriately.
- Cancel stale requests and prevent race conditions in the interface.
- Design timeouts, retries, circuit breaking and degraded modes for external dependencies.
- Important background jobs MUST be retryable, observable and idempotent.
- Queue backlogs, failure rates and latency MUST have operational thresholds.
- Capacity and failure tests MUST use production-like traffic patterns before major launches.

## 11. Observability and Audit Logging

### 11.1 Observability

Production systems MUST emit enough information to explain their behaviour through logs, metrics and traces.

- Use structured logs with timestamps, severity, service and correlation IDs.
- Capture request rate, error rate, latency and resource saturation.
- Trace important operations across services and external providers.
- Create dashboards for user-critical flows.
- Alert on user impact and sustained abnormal conditions, not every minor fluctuation.
- Redact secrets, credentials, tokens and unnecessary personal data.
- Synchronise clocks and use consistent timestamps.

### 11.2 Audit logs

Audit logs MUST cover security-sensitive and consequential actions, including:

- Login, logout, failed authentication and MFA changes.
- Role, permission and account-status changes.
- Data exports, deletions and administrative access.
- Payment, credit, order and configuration changes.
- Secret rotation and integration changes.
- AI actions that publish, send, purchase, delete or alter external state.

Each audit event SHOULD record who acted, what changed, the target, time, outcome, source and correlation ID. Audit logs MUST be protected from ordinary users and unauthorised alteration.

## 12. Testing and Quality Gates

Every release MUST pass the tests appropriate to its risk.

### 12.1 Automated tests

- Unit tests for core business rules.
- Integration tests for databases, queues and external adapters.
- End-to-end tests for critical user journeys.
- Contract tests for APIs and AI structured outputs.
- Accessibility tests for common violations.
- Migration tests using production-like data.
- Security tests for authentication, authorisation and input handling.
- Performance tests for important pages and endpoints.

### 12.2 Manual verification

- Test keyboard-only use and visible focus.
- Test responsive layouts on mobile, tablet, laptop and desktop widths.
- Test slow networks, offline transitions and failed requests.
- Test empty, loading, partial, success and error states.
- Test new, returning, suspended and unauthorised users.
- Test browser refresh during state-changing operations.
- Review browser console and network activity.
- Verify the custom favicon, metadata and sharing preview.
- Review copy for clarity, accuracy and generic AI language.

### 12.3 Release blockers

The following block release unless explicitly accepted by the accountable owner:

- Known broken authentication or authorisation.
- Hardcoded or exposed secrets.
- Destructive database changes without recovery planning.
- Failed critical-path tests.
- Unhandled payment, order or duplicate-action risk.
- Unresolved high-severity security findings.
- Missing monitoring for critical production flows.
- Browser console errors on core journeys.
- Inaccessible core functions.
- No rollback or recovery path for the release.

## 13. Deployment and Change Management

- Development, staging and production MUST be separated.
- Production deployments MUST be repeatable and traceable to a version.
- Configuration changes MUST be reviewed and auditable.
- Database migrations MUST be sequenced safely with application deployment.
- Use feature flags for risky or gradual releases when appropriate.
- Define health checks and post-deployment verification.
- Rollback or forward-fix instructions MUST be prepared before high-risk releases.
- Backups and restore procedures MUST be tested, not merely configured.
- Ownership and escalation paths MUST be known before launch.
- A post-incident review MUST produce corrective actions, owners and deadlines.

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

## 15. Standard AI Coding Agent Instruction

Use this instruction at the beginning of every build or audit:

> Apply the Application Build Master Rules to this project. First inspect the existing product, architecture, database, authentication, APIs, AI features, interface states, accessibility, performance, telemetry and deployment configuration. Do not make destructive changes or modify the production database directly. Propose version-controlled migrations and identify high-risk changes before implementation. Preserve existing behaviour unless a rule or approved requirement requires a change. Implement in small, reviewable stages. After each stage, run the relevant type, lint, test, accessibility, security and build checks. Record any rule that cannot be satisfied, the reason, the risk, the temporary control, the owner and the required follow-up. Do not claim completion while critical errors, hardcoded secrets, client-only permissions, untested migrations or broken core journeys remain.

## 16. Exception Register

Any rule that cannot be met before release MUST be recorded.

| Field | Required detail |
| --- | --- |
| Rule | The exact unmet requirement |
| Reason | Why it cannot be completed now |
| Risk | What could happen and who could be affected |
| Temporary control | What reduces the risk in the interim |
| Owner | Person accountable for resolution |
| Deadline | Date by which the exception ends |
| Approval | Accountable decision-maker |

Exceptions must expire. They are not permanent permission to weaken the standard.

## 17. Reference Standards

This standard is informed by the following primary references:

- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP Cryptographic Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- NIST SP 800-63B Digital Identity Guidelines: https://pages.nist.gov/800-63-4/sp800-63b.html
- W3C Web Content Accessibility Guidelines 2.2: https://www.w3.org/TR/WCAG22/
- OpenTelemetry Observability Primer: https://opentelemetry.io/docs/concepts/observability-primer/

## 18. Final Approval Rule

A product is not ready because the main screen works. It is ready when the normal path, failure path, recovery path and operational path have all been designed, implemented and verified.
