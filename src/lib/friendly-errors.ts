/**
 * Platform voice for things that go wrong.
 *
 * Every message follows: what happened -> what was preserved -> what to do next.
 * Plain language, no blame, no status codes, no stack detail.
 */

export type FriendlyOptions = {
  /** What the person was doing, e.g. "load your campaign". */
  action?: string;
  /** What is still safe, e.g. "Your draft is still saved." */
  preserved?: string;
};

const PATTERNS: { match: RegExp; message: string }[] = [
  {
    match: /(401|unauthor|not signed in|no session|jwt|token (has )?expired)/i,
    message: "Your session has ended. Sign in again to continue.",
  },
  {
    match: /(403|forbidden|permission|not allowed|access denied|rls)/i,
    message: "You don't have access to this yet.",
  },
  {
    match: /(offline|network|fetch failed|failed to fetch|econn|timed? ?out|timeout)/i,
    message: "You're offline. We'll reconnect when your connection returns.",
  },
  {
    match: /(429|rate limit|too many requests)/i,
    message: "This is busy right now. Try again in a moment.",
  },
  {
    match: /(credit|quota|payment required|402)/i,
    message: "This needs more credit before it can run. Try again once it's topped up.",
  },
  {
    match: /(reconnect|invalid credential|login failed|suspended|revoked)/i,
    message: "This account needs to be reconnected.",
  },
  {
    match: /(not found|404|no rows)/i,
    message: "We couldn't find this. It may have been removed.",
  },
  {
    match: /(invalid|required|must be|validation)/i,
    message: "Check the details and try again.",
  },
];

/**
 * Turns any thrown value into a calm, recovery-oriented sentence.
 * Never surfaces raw technical detail to the person using the platform.
 */
export function friendlyError(error: unknown, options: FriendlyOptions = {}): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const known = PATTERNS.find((pattern) => pattern.match.test(raw));
  const base = known
    ? known.message
    : options.action
      ? `We couldn't ${options.action} right now. Try again in a moment.`
      : "Something interrupted the request. Try again.";
  return options.preserved ? `${base} ${options.preserved}` : base;
}

/** Short confirmation voice: "Done.", "Your campaign is ready." */
export function friendlyDone(subject?: string): string {
  return subject ? `${subject} is ready.` : "Done.";
}
