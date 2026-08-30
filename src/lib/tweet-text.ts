/** Turns raw API text into the readable post: entities decoded, link clutter removed. */
export function cleanTweetText(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/https?:\/\/t\.co\/\w+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * X hides the pile of @handles a reply is addressed to and shows only the
 * body. Strip the leading run of mentions so the card reads like the post.
 */
export function stripLeadingMentions(text: string): string {
  const body = text.replace(/^(?:@[A-Za-z0-9_]{1,15}[\s,]+)+/, "").trim();
  return body.length > 0 ? body : text;
}

/** The post exactly as X would render it in a card. */
export function readablePostText(raw: string | null | undefined): string {
  if (!raw) return "";
  return stripLeadingMentions(cleanTweetText(raw));
}
