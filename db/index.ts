// Barrel re-export so `import { db } from "@/db"` resolves correctly.
// Actual implementation lives in db/db.ts — do not duplicate logic here.
export { db, client, checkDatabaseConnection, logDatabaseConnectionStatus } from "./db";
