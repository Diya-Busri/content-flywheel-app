# Jarvis Phase 1 — manual verification checklist

> **UI location update:** the standalone `/jarvis` page has been removed.
> The same execution engine now lives inside **AI Coach → Tasks** at
> `/dashboard/ai-coach?mode=tasks`. The backend (`lib/jarvis/*`,
> `/api/jarvis/*`, `execution_runs`/`execution_steps`) is unchanged — only
> the entry point moved. Wherever this doc says "go to `/jarvis`," read it
> as "go to AI Coach and click the **Tasks** tab" instead.

This sandbox that built Jarvis has no network route to Supabase, so none of
this could be executed automatically — everything below needs to be run
against a real `npm run dev` with a real database. Migration has already
been applied (`npm run db:jarvis` confirmed both `execution_runs` and
`execution_steps` exist).

Prerequisite: `OPENAI_API_KEY` set in `.env.local` (Jarvis uses the same
OpenAI setup as the rest of the app).

## 1. Core journey

1. Sign in, go to `/jarvis` (or click "Jarvis" in the sidebar, under Create).
2. Type: `Content Flywheel needs more sales. Create content for this week.`
   and hit Start.
3. **Expect:** the execution panel appears immediately and walks through
   Planning → Reading business memory → Analysing product → Creating
   strategy, each turning into a green check as it completes.
4. **Expect:** it lands on a plan screen — objective summary, strengths/gaps,
   which assets will be generated and why. If your test account has no
   products or brand profile, you should also see 1–2 inline questions
   before you can continue — answer them (or skip if none appear).
5. Click **Generate assets**.
6. **Expect:** it lands on the asset review screen with every proposed
   video script / carousel / email as its own card, all checked by default.
7. Uncheck at least one asset.
8. Click the pencil icon on another asset, change some text, **Save
   changes**, confirm the card updates and shows an "Edited" badge.
9. Click **Approve & save N** (N should match however many are still
   checked).
10. **Expect:** results screen — every saved asset listed with a link
    ("Open in Library" or "Open in Email Marketing"), the deselected one
    listed separately under "Not saved (deselected)".
11. Open `/dashboard/library` in a new tab — the approved video
    scripts/carousels should be there as drafts. Open
    `/dashboard/email-marketing` — the approved email should be there as a
    draft (never sent).
12. Back on the results screen, click **Start new task** — confirm it
    returns to the empty goal screen, and the finished run still shows up
    under "Recent tasks" if you go back to `/jarvis` fresh.

## 2. Refresh recovery

Repeat step 1–2 above, then **before** clicking anything on the plan
screen, hard-refresh the page.
**Expect:** you land back on the exact same plan screen (URL should have
kept `?run=<id>`), not a blank goal screen and not a re-run of planning.

Do the same after clicking "Generate assets" — refresh while assets are
showing. **Expect:** the same assets reappear, not a fresh generation
(the AI shouldn't be called again — you can eyeball this by noting the
copy is identical to before the refresh).

## 3. Double-click / idempotency

On the asset review screen, click **Approve & save N** and then
immediately click it again (or double-click fast).
**Expect:** only one set of rows appears in `/dashboard/library` /
`/dashboard/email-marketing` — not two. The second click should just show
the same completed result, not an error, not a duplicate save.

Same test on **Generate assets** on the plan screen — double-click it and
confirm only one round of assets appears, not two batches merged together.

## 4. Failure + retry

Temporarily set `OPENAI_API_KEY` to an invalid value, start a new run.
**Expect:** the run fails cleanly at the planning stage with a red error
card and a "Retry planning" button — status should NOT show as completed
anywhere. Restore the real key, click "Retry planning", confirm it picks
back up and succeeds.

## 5. Cross-user isolation

Sign in as a second test account. Note a run id from the first account
(visible in the URL as `?run=<uuid>` or in the network tab).
Navigate to `/jarvis?run=<that-uuid>` while signed in as the second user.
**Expect:** it behaves as if no run exists (falls through to the empty
goal screen / 404 from the API) — never shows the first user's goal, plan,
or assets.

## 6. Safety

Across the whole journey above, confirm none of the following ever
happened, because no tool exists to do any of them in Phase 1:
- nothing was published to the storefront
- no email was actually sent (emails only ever appear as `draft` status)
- no video/voice generation, no Higgsfield credits spent
- no pricing or storefront fields changed
- nothing was deleted

## 7. Final summary honesty

On the results screen, the message and the per-asset list should only
ever describe assets that have `savedRefId` set — if you engineer a
failure mid-save (e.g. kill the DB connection mid-approve, or just trust
the code path since it's inside one transaction — see
`lib/jarvis/tools/save-content-campaign.ts`), the run should show
**failed**, not completed, and nothing should be partially saved.

## Known Phase 1 limitation

If the server process is killed or times out in the middle of a phase
(after it has claimed the run via the compare-and-swap but before it
reaches either the success or failure transition), the run can be left
stuck in `running` with no retry button — the UI's retry only appears for
`status: "failed"`. This is a narrow crash-only edge case (not a normal
error path — normal tool failures are always caught and transition to
`failed`). Given typical serverless timeouts, it's unlikely in practice,
but worth knowing about; a follow-up could add a stale-`running` auto-fail
sweep if it turns out to matter.
