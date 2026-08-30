/**
 * @deprecated Monitoring and campaign execution are intentionally separate.
 *
 * The managed Monitoring Watchlist is stored in `monitoring_watchlist` and is
 * used only to prioritise intelligence. A watched account must never become an
 * automatic like, repost, bookmark, follow or reply target merely because it
 * is being monitored.
 *
 * Older execution code may still import these constants, so keep the exports
 * but leave them empty. Campaign targets must be chosen explicitly in the
 * campaign workflow.
 */
export const WATCH_HANDLES: string[] = [];

/** Legacy compatibility only. No watched posts are auto-engaged. */
export const WATCH_TWEETS_PER_ACCOUNT = 0;
