/**
 * platform_connections
 * ──────────────────────────────────────────────────────────────────────────────
 * Stores per-user connections to external publishing platforms.
 * Tokens are stored as JSONB (encrypt at rest in production).
 *
 * Migration SQL:
 *   CREATE TABLE platform_connections (
 *     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id TEXT NOT NULL,
 *     platform TEXT NOT NULL,
 *     account_name TEXT,
 *     account_id TEXT,
 *     connection_data JSONB,
 *     connected_at TIMESTAMP DEFAULT NOW() NOT NULL,
 *     updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
 *     UNIQUE(user_id, platform)
 *   );
 */

import { pgTable, text, timestamp, uuid, jsonb, unique } from "drizzle-orm/pg-core";

export type PlatformId =
  | "tiktok"
  | "youtube"
  | "instagram"
  | "facebook"
  | "x"
  | "linkedin"
  | "email";

export type PlatformConnectionData = {
  /** OAuth access token (store encrypted in production) */
  accessToken?:  string;
  refreshToken?: string;
  expiresAt?:    string;
  scope?:        string;
  /** For email: API key (Resend/SendGrid/etc.) */
  apiKey?:       string;
  /** For email: from address */
  fromEmail?:    string;
  fromName?:     string;
  /** For email: to address (for test sends) */
  toEmail?:      string;
  /** Additional platform-specific config */
  extra?:        Record<string, string>;
};

export const platformConnectionsTable = pgTable(
  "platform_connections",
  {
    id:             uuid("id").defaultRandom().primaryKey(),
    userId:         text("user_id").notNull(),
    platform:       text("platform").$type<PlatformId>().notNull(),
    accountName:    text("account_name"),
    accountId:      text("account_id"),
    connectionData: jsonb("connection_data").$type<PlatformConnectionData>(),
    connectedAt:    timestamp("connected_at").defaultNow().notNull(),
    updatedAt:      timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({ uniq: unique().on(t.userId, t.platform) }),
);
