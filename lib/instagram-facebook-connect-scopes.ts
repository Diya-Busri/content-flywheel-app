/**
 * Facebook Login dialog scopes for Instagram connect (facebook.com/.../dialog/oauth).
 * Use Facebook Login permission names only — not Instagram-product-specific scope aliases.
 */
export const INSTAGRAM_FACEBOOK_CONNECT_SCOPES =
  "pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement";

/** Stored row includes this; publish route uses it to trust Page token + IG id without re-resolving. */
export const INSTAGRAM_PUBLISH_SCOPE_MARKER = "instagram_content_publish";
