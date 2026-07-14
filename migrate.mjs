import postgres from '/sessions/dazzling-admiring-brahmagupta/mnt/content-flywheel-app/node_modules/postgres/src/index.js';
import { readFileSync } from 'fs';

const sql = postgres('postgres://postgres.mjmmczeocsaukrvobves:kGL55ILMSDceMjYO@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require');
const migration = readFileSync('/sessions/dazzling-admiring-brahmagupta/mnt/content-flywheel-app/db/migrations/add-motion-graphics-projects.sql', 'utf8');

try {
  await sql.unsafe(migration);
  console.log('✅ Migration applied successfully');
} catch (e) {
  if (e.message?.includes('already exists')) {
    console.log('✅ Table already exists — migration already applied');
  } else {
    console.error('❌ Migration error:', e.message);
    process.exit(1);
  }
} finally {
  await sql.end();
}
