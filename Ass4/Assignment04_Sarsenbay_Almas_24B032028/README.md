# Smart Campus Room Availability Checker — Assignment #04

**Course:** Software Engineering  **Assignment:** #04 (AI-assisted evolution, refactoring and quality improvement)
**Student:** Sarsenbay Almas  **ID:** 24B032028  **Group:** Wednesday 08:00–11:00
**AI assistant used:** Claude (Anthropic) — see `report/` for the AI-use record.

This repository contains the **initial version (v1)** — a monolithic single-room prototype — and the
**final version (v2)** — a modular, tested, multi-room application with capacity/equipment filtering.
No login, payments, live APIs or database; all data is fictional; the "current time" is fixed at **09:00**.

## Requirements
* **Node.js 22 or newer** (tested with v22.23.4). No `npm install` is needed — there are zero dependencies.
* A modern browser for the UI.
* *Optional (browser UI check only):* Python 3 + `pip install playwright` + `playwright install chromium`.

## Run the application (v2)
```bash
npm start            # serves final/ at http://localhost:8080  (set PORT=9000 to change)
```
Open http://localhost:8080. (ES modules cannot load from `file://`, hence the tiny static server in `final/server.js`.)
The original v1 prototype can be opened directly: `initial/index.html`.

## Run the tests
```bash
npm test                  # all Node tests: 48 tests (v1 baseline + v2 + v1-vs-v2 regression)
npm run test:initial      # v1 baseline AC1–AC5               (7 tests)
npm run test:final        # v2 AC1–AC6 regression + F1–F5 + integration/UI (39 tests)
npm run test:regression   # same inputs, v1 vs v2, identical status AND message (2 tests, 24 scenarios)
python3 tests/e2e/ui_check.py       # optional: real Chromium UI check (17 checks) + screenshots
python3 scripts/mutation_check.py   # injects 12 deliberate bugs into a copy; every one must be caught
npm run demo              # console demonstration of filtering, room switching and availability checks
npm run metrics           # duplication / structure measures for v1 vs v2
./scripts/run_evidence.sh # re-runs everything above and rewrites evidence/*.txt
```

## Repository layout
```
initial/                  v1 baseline (index.html, app.js — rules + data + DOM in one file)
final/
  index.html, styles.css  responsive page (2 columns >= 52rem, 1 column on phones)
  server.js               zero-dependency static server
  src/config.js           NOW_HHMM = 09:00, MAX_DURATION_MINUTES = 120 (single source of truth)
  src/data/rooms.js       catalog: 5 fictional rooms (id, name, capacity, equipment, blocked, bookings), deep-frozen
  src/core/time.js        the ONLY HH:MM parser/formatter
  src/core/availability.js  AC1–AC4 rules: validateRequest, intervalsOverlap, findConflict, checkAvailability
  src/core/filter.js      F1–F2: parseRequirements, filterRooms, listEquipment
  src/ui/store.js         state + reduce() + buildViewModel() (no DOM)
  src/ui/render.js        view model -> escaped HTML strings (single result template)
  src/ui/main.js          DOM wiring only
tests/                    initial.ac / final.availability / final.filter / final.integration / regression / e2e
scripts/                  demo, metrics, mutation check, evidence runner
evidence/                 recorded command outputs + screenshots
report/                   report (DOCX), diagrams, AI evidence appendix
```
Git: `git log --oneline --decorate` — tag `v1-initial` is the baseline, tag `v2-final` is the submission.

## Behaviour summary
* **AC1** times must be `HH:MM`, end after start, start not earlier than 09:00 · **AC2** max 120 min (120 ok, 121 rejected)
* **AC3** blocked room is never available · **AC4** overlap = conflict, touching intervals (10:00 end / 10:00 start) are fine
* **AC5** catalog and bookings are deep-frozen; checks never change them · **AC6** specific messages, colour + text status, responsive layout
* **F1** capacity ≥ attendees · **F2** room must have ALL selected equipment · **F3** blocked rooms stay listed with a *Blocked* badge but can never be *available*
* **F4** empty state "No rooms match …" · **F5** switching the selected room re-evaluates the result for the new room's own bookings
* Result order of rules: invalid input → too long → blocked → conflict → available.

## Assumptions
The Assignment #03 / Practice #06 prototype was not supplied, so an equivalent minimal v1 was reconstructed (allowed by the brief).
AC1 was interpreted as: valid `HH:MM`, end after start, start not before the fixed current time (09:00).
