# AI Coach Task Mode — Final Verification Checklist

Branch: `feature/jarvis-phase1` (not merged). Latest commits: `eeea1eb8`
(frontend migration into AI Coach) and `ac7651ac` (tab-switch state fix).

My sandbox has no network route to Supabase or OpenAI, so I can't run
`npm run dev` against real data myself, and I can't reach a server on your
machine from here either — this has to be run by you against a real
`npm run dev`. Fill in Pass/Fail and notes as you go and send it back;
anything marked Fail I'll fix before you merge.

## Already fixed (found via code review before you even start)

1. **Tab switching was wiping Chat state.** The switcher used to unmount
   `AICoachPageClient` whenever you clicked "Tasks," which reset which
   conversation was open, dropped any unsent draft text, and would have
   killed an in-progress voice call. Fixed: both panels now stay mounted;
   switching tabs just toggles visibility with CSS.
2. **Back/forward didn't move between Chat and Tasks.** The tab click used
   `router.replace()`, which doesn't add a browser history entry. Fixed:
   the tab click now uses `router.push()`, so back/forward works between
   modes. (Run-id changes inside Task Mode still use `replace` on purpose,
   so polling doesn't spam your history.)

Both are in `app/dashboard/ai-coach/AICoachModeSwitcher.tsx`, commit
`ac7651ac`. Please specifically re-check items 6 and the back/forward item
below since these are the two things I couldn't verify without a real
browser.

## Setup

1. `npm run dev` on this branch, sign in, keep the tab open throughout.
2. Have a second browser profile/incognito window ready for the
   cross-user isolation-style checks if you want to repeat those from
   Phase 1 (not re-listed below since they didn't change in this pass).

## Core walkthrough

| # | Step | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 1 | Open `/dashboard/ai-coach` | Page loads with a Chat / Tasks tab bar at the top | | |
| 2 | Look at Chat Mode | Loads exactly as before this change — same layout, same sessions in the sidebar | | |
| 3 | Exercise chat history, search, memory, focus/product selector, attachments, voice input, "new chat" | All behave exactly as pre-migration | | |
| 4 | Click the **Tasks** tab | View switches to the goal input screen | | |
| 5 | Check the URL, then refresh | URL shows `?mode=tasks`; after refresh you're still on Tasks | | |
| 6 | Type a partial draft in Chat, switch to Tasks, switch back to Chat | Same session is still open, draft text is still in the box, scroll position unchanged | | |
| 7 | In Tasks, submit: *"Create a marketing campaign to help Content Flywheel get more sales this week."* | Execution panel appears | | |
| 8 | Watch the panel | Steps progress: Planning → Reading business memory → Analysing product → Creating strategy | | |
| 9 | Wait for planning to finish | Plan/strategy approval card appears (objective, strengths/gaps, planned assets, any missing-info questions) | | |
| 10 | Hard-refresh the page while on the plan approval screen | Same task reappears at the same approval step (URL kept `?mode=tasks&run=<id>`), not a blank screen, not re-planned | | |
| 11 | Click **Generate assets** | Generation begins | | |
| 12 | Wait for generation to finish | Asset review screen appears once, with one full set of assets (not duplicated) | | |
| 13 | Hard-refresh while on the asset review screen | Same assets reappear unchanged — no new AI call, no regeneration | | |
| 14 | Edit one asset's text (save the edit), uncheck another asset | Edited asset shows an "Edited" badge; unchecked asset stays unchecked | | |
| 15 | Click **Approve & save N** | Save runs, results screen appears | | |
| 16 | Check the results screen | Only the assets that were still checked are listed as saved; the deselected one is listed separately as not saved | | |
| 17 | Open `/dashboard/library` (Chat tab or new tab) | The approved video scripts/carousels appear as drafts | | |
| 18 | Open `/dashboard/email-marketing` | The approved email appears as a draft, never sent | | |
| 19 | Click **Start new task** | Returns to the empty goal screen; the finished run still shows under "Recent tasks" | | |
| 20 | Check the sidebar and try navigating to the old `/jarvis` URL directly | No "Jarvis" entry in the sidebar; `/jarvis` 404s (route no longer exists) | | |

## Edge cases

| # | Step | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 21 | On the plan approval screen, click **Generate assets** twice fast (or double-click) | Only one generation happens — button disables immediately, and even if both clicks land, the server rejects the second | | |
| 22 | On the asset review screen, click **Approve & save** twice fast | Only one save happens — one set of rows in Library/Email Marketing, not two | | |
| 23 | Temporarily break `OPENAI_API_KEY`, start a new task | Run fails cleanly with a red error card and a retry button — never silently marked completed | | |
| 24 | Restore the key, click retry | Picks back up and succeeds from where it failed | | |
| 25 | Resize to a mobile width (~375px) | Tab bar, goal input, execution panel, and approval screens all remain usable, nothing overflows or gets clipped | | |
| 26 | Resize to a narrow desktop width (~900–1000px) | Same — no broken layout | | |
| 27 | On Chat, click Tasks, then use the browser **Back** button, then **Forward** | Back returns to Chat, Forward returns to Tasks — both preserving whatever state each was in | | |

## Reporting back

For anything marked Fail, a screenshot plus what you expected vs. what
happened is enough for me to track it down — I don't need console logs
unless something throws visibly.

## Remaining risks (not blockers, just worth knowing)

- I have not been able to exercise this against a real OpenAI/Supabase
  connection myself in this session, so items 7–19 and 23–24 are
  logically verified by reading `lib/jarvis/orchestrator.ts` and the tool
  files (status/gate transitions, transaction boundaries, CAS idempotency
  checks) but not empirically run.
- Both panels now stay mounted simultaneously (the item 6 fix). This means
  Task Mode's polling continues in the background while you're looking at
  Chat, which is intentional (a run shouldn't stall just because the tab
  isn't visible) but means slightly more background network activity than
  before while a task is active.
- I did not re-touch `AICoachPageClient.tsx` at all in this pass, per the
  original instruction to treat it as a black box — items 2–3 should be
  unaffected by anything in this branch, but worth your own quick look
  since I can't run it here.
