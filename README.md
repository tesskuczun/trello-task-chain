# Task Chain: a Trello Power-Up for sequential tasks

Link each card to the task that must finish before it. Cards show a red
**Blocked by: …** badge until the previous task is done, then a green **Ready** badge.

## Files

| File | Purpose |
|---|---|
| `index.html` | The iframe connector Trello loads |
| `client.js` | All the Power-Up logic |
| `icon.svg` | Button and badge icon |

## Install

1. **Host the files over HTTPS.** GitHub Pages is free:
   - Create a public repo, upload `index.html`, `client.js` and `icon.svg`.
   - Repo **Settings → Pages → Deploy from branch → main / root**.
   - Your URL will look like `https://<username>.github.io/<repo>/index.html`.
2. **Register the Power-Up** at <https://trello.com/power-ups/admin>:
   - Click **New**, pick your Workspace, and set **Iframe connector URL** to the
     `index.html` URL from step 1.
   - On the **Capabilities** tab, turn on **Card buttons**, **Card badges** and
     **Card detail badges**.
3. **Add it to a board:** open the board → **Power-Ups** → **Custom** → add *Task Chain*.

## Use

- Open a card and click **Previous task** (in the Power-Ups button area).
- Search for and pick the card that must finish first. Pick **✕ Clear previous task** to unlink.
- Click the badge inside an open card to change the link.

A previous task counts as **done** when any of these is true:
- it's in a list named Done, Complete, Completed, Finished or Shipped (edit
  `DONE_LIST_NAMES` at the top of `client.js` to change this);
- its due date is ticked complete;
- it's archived or deleted.

Picking a previous task that would create a loop (A waits on B, B waits on A) is refused.

## Limitations

- Power-Ups only run while someone has the board open, so this **shows** order but
  can't move cards on its own. Badges re-check about every 10 seconds.
- Each card has one previous task (a chain, not "wait for A *and* B").
- Links are stored per-card in Trello's Power-Up data, so they only exist on boards
  where the Power-Up is enabled.

## Optional: auto-advance with Butler (Automation)

To move the next card forward automatically, add a matching URL link between the cards
(paste the next card's link into the previous card as an attachment), then create a rule
in **Automation → Rules**:

- **Trigger:** when a card is moved into list "Done"
- **Action:** *for the first card linked in the card's attachments*, move the card to the
  top of list "To Do"

The Power-Up badges and the Butler rule work independently; use either or both.
