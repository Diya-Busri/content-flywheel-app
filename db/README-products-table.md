# Fix: "relation 'products' does not exist"

If Create My Product fails with **Generation failed - relation "products" does not exist**, the `products` table has not been created yet.

## Option 1: Run SQL in Supabase (recommended)

1. Open your **Supabase** project → **SQL Editor** → **New query**.
2. Copy the contents of **`db/create-products-table.sql`** and paste into the editor.
3. Click **Run**.
4. In **Table Editor** you should see the **products** table with columns: `id`, `user_id`, `title`, `niche`, `format`, `content`, `design_settings`, `placed_elements`, `created_at`, `updated_at`.

**Note:** This app uses **Clerk** for auth, so `user_id` is stored as **TEXT** (e.g. `user_2abc...`), not UUID. The SQL file matches that. Do not use `user_id UUID REFERENCES auth.users(id)` or the app inserts will fail.

## Option 2: Run Drizzle migrations

If you use Drizzle migrations against the same database:

```bash
npm run db:migrate
```

If the `products` migration was not applied yet, ensure it runs (you may need to sync the migrations journal with your migration files).

## After the table exists

1. Refresh the app.
2. Go to Discover → complete the flow → choose a format (e.g. Course Outline).
3. Click **Create My Product**.
4. It should succeed and redirect to the product editor.
