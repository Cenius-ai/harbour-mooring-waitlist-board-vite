# Using the Harbour Mooring Waitlist Board

Sign in at `/login` with `cenius@cenius.ai` / `cenius` (the credentials are printed
on the card, and there is a one-click demo sign-in button).

The left rail carries four sections — **Dashboard**, **Buoys**, **Waitlist** and
**Inspections** — and your name and sign-out control sit at the foot of it.

---

## Harbour overview (`/dashboard`, and `/` when signed in)

Answers "what needs attention today".

* Four counters, each a link into the matching filtered screen: buoys **available**,
  **occupied**, **in maintenance**, and **owners waiting** (split S / M / L).
* **Inspections overdue** — every buoy with no inspection on record or a last
  inspection more than twelve months old, with its bay, the date of the last
  inspection (or "Never inspected") and how far overdue it is. Clicking a code opens
  that buoy.
* **Longest waiting** — one owner per mooring size with the days waited; clicking one
  opens the waitlist filtered to that size class.
* **Bays** — each bay with its buoy count, linking into the register filtered by bay.
* A legend explaining how status is read (status is always a word as well as a
  colour).

If nothing is overdue the panel says **"All inspections are current"** instead of
showing an empty table.

---

## Buoy register (`/buoys`)

Buoys are grouped under their bay heading, showing code, size class, depth in
metres, swing radius in metres, availability pill and last inspection date.

* **Filter bar** — search on buoy code, plus bay, size class and availability
  filters. Filters live in the URL, so a filtered view can be linked and reloaded.
  "Clear filters" restores the full register.
* **New buoy** opens the create dialog. Creating a buoy adds it to the correct bay
  group without a page reload, with a short flash to show what changed.
* Each row has **Open**, **Edit** and **Delete**.
* **Delete** asks for confirmation naming the buoy, its bay, its status and size
  class, and warns that its inspection records are removed with it.
* Creating or editing validates in the browser first (`code` required, depth and
  swing radius greater than zero) and the server re-checks the same rules, returning
  per-field messages plus a 409 `Buoy code already exists` for a duplicate code.

Empty states: with no buoys at all the panel offers **"Add the first buoy"**; with
filters that match nothing it explains that and offers to add one for the selected
bay.

---

## Buoy detail (`/buoys/:id`)

Three panes: the navigation rail, the register list on the left (scrollable, with the
current buoy highlighted) and the mooring's own record on the right.

* **Mooring specification** — bay, depth at chart datum, swing radius, last
  inspection (with a relative date), the next annual due date and how many
  inspections are on file, plus any notes.
* **Availability** — a select that saves as soon as you change it; the register list
  updates with it.
* **Edit specification** reopens the same dialog the register uses.
* **Inspection history** — newest first, with date, inspector, chain wear and notes,
  and edit/delete per row.
* **Record inspection** opens the shared dialog with this buoy already chosen.

An unknown id shows a **"Buoy not found"** page with a link back to the register
rather than an error.

---

## Waitlist board (`/waitlist`)

Three groups — S, M and L — each showing the queue in joining-date order with a
visible 1-based position and the days waited. The longest-waiting entry in each group
is flagged.

* **Filter bar** — search on owner or boat name, plus size class and status.
* **Add owner** opens the create dialog; each group's empty state offers an
  "Add owner for M" button that preselects that size.
* Each entry shows the owner, the boat and its length overall, the joining date, and
  a collapsible block with contact details and notes.
* The **status select** on each entry moves it between waiting, placed and withdrawn.
  Placed and withdrawn rows leave the active queue and their position becomes `–`;
  setting one back to waiting restores it to its date-ordered place immediately.
* **Remove** asks for confirmation before deleting the entry.

Validation: owner name, boat name, boat length and a joining date that is not in the
future, checked in the browser and again on the server (per-field messages).

---

## Inspections ledger (`/inspections`)

Every annual inspection in the harbour, newest first, with date, buoy code, bay,
inspector, chain wear (flagged as **attention** at 50% or more) and notes.

* **Filter bar** — calendar year and buoy, with a running count of the records in
  view and a "Clear filters" button.
* **Record inspection** opens the shared dialog: buoy, inspection date, inspector and
  chain wear as a whole percentage from 0 to 100.
* The **annual guard**: a buoy cannot collect two inspections in the same calendar
  year. The server answers `409` with `This buoy already has an inspection recorded
  for 2025`, and the dialog stays open with the message next to the date field and
  every typed value kept.
* Rows can be edited or deleted, and both the table and the count update immediately.
* Selecting a year with no records shows `No inspections recorded in 2025` with a
  Record inspection button.

---

## States you will see

* **Loading** — skeleton rows shaped like the table they replace, with the filter bar
  still usable.
* **Empty** — a line explaining why plus the primary action, and a different message
  when filters are the reason rather than genuinely no data.
* **Error** — a banner naming the failure with a **Retry** that re-runs the same
  call. A save that fails keeps every typed value and shows the message at the field.
* **Session expiry** — any `401` from the API clears the local session and returns
  you to `/login`; signing back in returns you to the page you originally asked for.

---

## Keyboard and pointer

* Every dialog traps focus while open, closes on `Escape` and returns focus to what
  you were using.
* `Tab` order follows the visual order; every focusable control has a visible focus
  ring and the active panel shows the board's corner ticks.
* All controls are at least 40px tall and reach 44px on touch widths; the layout
  stacks to a single column from 360px up with no horizontal scrolling.
* Sign-in has a show/hide password toggle, and `Enter` submits every form.
* `prefers-reduced-motion` collapses the transitions and the data-update flash.
