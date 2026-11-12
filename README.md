# Task Chain: a Trello Power-Up for tasks done in order

Link each card to the task that must finish before it. Trello then shows:

- **On the board:** "Step 2 of 4", a red lock badge **Blocked by: …** until the
  previous task is done, then a green **Ready** badge. The first task in a chain
  gets an orange flag: **3 tasks wait on this**.
- **Inside a card:** a **Task order** section. The card sits on top, with every
  task that must happen first stacked underneath, numbered in order. The next one
  to do is highlighted. Tasks waiting on this card are listed after. Click any
  task name to open it.

Badges update about 1–2 seconds after a task is finished.

## Files

| File | Purpose |
|---|---|
| `index.html` | The hidden page Trello loads |
| `shared.js` | Chain logic shared by both pages |
| `client.js` | Buttons, badges, and the auto-update |
| `section.html`, `section.js` | The "Task order" section inside a card |
| `icon.svg`, `lock.svg`, `check.svg`, `flag.svg` | Icons |

## Install

1. Host all files over HTTPS (for example GitHub Pages).
2. Register the Power-Up at <https://trello.com/power-ups/admin> with the hosted
   `index.html` as the iframe connector URL.
3. Turn on **Card buttons**, **Card badges**, **Card detail badges** and
   **Card back section**.
4. Add it to a board: **Power-Ups → Custom → Task Chain → Add**.

## Use

Open a card → **Power-ups** → **Previous task** → pick the card that must finish
first. Pick **✕ Clear previous task** to unlink.

A task counts as **done** when it's in a list named Done, Complete, Completed,
Finished, Shipped or Archived (edit `DONE_LIST_NAMES` in `shared.js`), when its
due date is ticked complete, or when it's archived.

## Limits

- Each card waits on one task. Several cards can wait on the same task.
- Trello stores about 4 KB of links per board (roughly 80 links).
- Updates happen while someone has the board open in Trello.
