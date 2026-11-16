# State legislatures: research and proposed model

Status: research only (2026-11-16). Nothing here is built or connected to Bills yet.

Goal: hold, for each state, its legislative chambers, session open/close dates (and recesses where known), and its committees with links to the official committee page, reliably enough to later attach to Bills.

## What the sources can actually give us

### Chambers: stable, seed once

Chamber names change roughly never, so a hand-checked list in code or seed data is the reliable option. Points the model must allow:

- Nebraska and the DC Council are **unicameral**. Puerto Rico is bicameral.
- Lower chamber names vary: House of Representatives (most), Assembly (CA, NV, NY, WI), House of Delegates (MD, VA, WV), General Assembly (NJ).
- The body itself is variously the Legislature, General Assembly, General Court (MA, NH) or Legislative Assembly (ND, OR).
- Connecticut runs almost entirely on **joint** committees, so "chamber" on a committee needs a `joint` option.

### Committees: Open States data is good but needs link checking

Source: [openstates/people](https://github.com/openstates/people) (CC0 licence; one YAML file per committee; updated continually, last commit 2026-11-05). Each record has an id, name, chamber, `links`, `sources` and current members.

Measured on 2026-11-16 (50 states + DC + PR, excluding Congress):

| Check | Result |
|---|---|
| Committees | 2,796 |
| Has at least one link | 2,755 (98.5%) |
| Link host is the state's own site (.gov / .state.xx.us etc.) | nearly all |
| Link pinned to a pre-2025 session (e.g. `year=2024`, `/2021/`) | ~430 (15%) |
| Link is a data endpoint, not a page people can read (GraphQL, XML, AWS API) | ~98 (e.g. all of Alabama) |
| Subcommittees for states | none recorded |
| Sample of 52 links (one per jurisdiction) | 44 returned 200; 2 were 404 (MI, PA, both old-session URLs); 2 blocked automated requests (HI, NY Senate); 2 had TLS chain errors to a script (IL, CT; likely fine in a browser); 1 failed to fetch (AZ). Of the 200s, several are old-session pages (e.g. Idaho 2021, Pennsylvania 2023) |

Data-quality notes: Wyoming, Connecticut, Nebraska and DC committees are all filed under `legislature` rather than a chamber (right for CT/NE/DC, a simplification for WY). Members come along for free if we ever want them.

Conclusion: reliable enough as a **starting import**, not as a live source of truth for links. We need our own link field that editors can correct, a periodic link check, and a sync that never overwrites an editor's fix.

The [Open States API v3](https://docs.openstates.org/api-v3/) has a `/committees` endpoint built from the same data (free key required, marked experimental). The repo is simpler and needs no key.

For Congress, [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) `committees-current.yaml` is the standard source, with subcommittees and official URLs.

### Session dates: no single reliable feed

| Source | What it has | Problems |
|---|---|---|
| [NCSL session calendar](https://www.ncsl.org/about-state-legislatures/2026-state-legislative-session-calendar) | Per state: regular convene/adjourn, special sessions (with subject), comments such as veto sessions and recesses. Revised through the year (2026 page updated Oct 13; earlier PDFs differ). | Web page, no feed or licence for automated reuse. Uses "Meet throughout year" for full-time legislatures (MI, NY, etc.). Recesses only where NCSL chose to note one (e.g. NY "in recess 6/5/26 to 1/6/27"). |
| Open States scrapers ([session metadata](https://github.com/openstates/openstates-scrapers)) | Start/end for every session, including specials, for 51 of 52 jurisdictions (Maine missing). | These are scraper bookkeeping dates, not adjournment dates: biennium spans (MI 2025-01-08 to 2026-12-31), placeholder end dates (RI and NH both 06-30), and differences from NCSL. |
| [Ballotpedia](https://ballotpedia.org/Dates_of_2026_state_legislative_sessions) | Projected dates. | Projections that can differ from NCSL's. |
| Each legislature's own calendar | The only source for planned recesses and key deadlines (crossover day, governor signing deadline). | 50 different formats, often PDF. |
| State Net (already subscribed) | Resources > Session Calendars: Regular Sessions, Future Sessions and Special Sessions. Per session: name, status, drafting/prefiling date, intro deadlines (per chamber), governor deadline, adjourn date, carryover, notes (specials: "RE: subject"); marks complete (`*`) and projected (`~`) dates. | No export, but the pages can be saved as HTML and parsed (below). **No convene date on any of the three pages.** Coverage gaps (below). |

Example of the disagreement, Alabama 2026 regular session adjournment: Open States 04-02, NCSL 04-08, Ballotpedia 03-27. State Net, the source the team already uses for bills, gives 04-09, one day from NCSL, and adds the governor deadline (04-19).

Conclusion: session dates should be **editor-maintained records**, each storing where the date came from and whether it is scheduled or actual. Seed them once a year from State Net, falling back to NCSL for anything State Net does not list and for every convene date. Add recesses by hand only for the states that matter most.

### What the three State Net pages cover (November 2026 saves)

| Page | Rows | What it is | Gaps |
|---|---|---|---|
| Future Sessions | 53 rows, 52 jurisdictions | One row per jurisdiction for **2027**, status "WILL MEET IN CURRENT YEAR". 51 of 53 adjourn dates are projected (`~`); governor deadlines follow from them. Prefiling dates or notes ("Does not prefile", "after election"). Also lists Guam and the US Virgin Islands. | Missing NJ (its 222nd Legislature, 2026–27, sits on the Regular page), VA and PR. ND and NV still carry a stale "NO REGULAR 2026 SESSION" row; NV also has its 2027 row, but ND's 2027 session is missing. |
| Regular Sessions | 27 rows, 25 jurisdictions | 2026 sessions with actual (`*` = complete) adjourn and governor dates, plus "NO REGULAR 2026 SESSION" for MT and TX. | Every missing state except DC, PR and Congress is in a two-year session that began in 2025 (or, for ND and NV, has no 2026 session), so State Net files sessions under their **start year**. The 2025 page would be needed for those. |
| Special Sessions | 12 rows, 7 states | 2026 specials (plus one from Dec 2025), with "RE: …" subjects. | Only states that held a special appear, so its "missing" list means nothing. |

So the Future Sessions page, saved in December or January, is the one that seeds the year: it covers nearly every jurisdiction in one place. The Regular and Special pages are for recording actual dates once sessions end. Not yet known: whether the Future page in an even year (the second year of most bienniums) still lists every state, or only those starting a new session. Check that when saving the 2028 page.

### Yearly State Net import (manual save, scripted parse)

State Net has no export, and the import does not need to be automated end to end. Each December/January, a person (or an AI agent working with them):

1. In State Net, open Resources > Session Calendars > Future Sessions, Regular Sessions and Special Sessions, and save each from the browser as HTML (File > Save Page As) into the git-ignored `input/` folder.
2. Run `pnpm tsx scripts/parseStateNetSessions.ts "input/<saved page>.htm"` for each. It writes JSON next to the page and prints a report: the year the page covers, missing jurisdictions, untracked ones (GU, VI), projected dates, stale or contradictory "no session" rows, and any cell it could not read as a date. It touches no database.
3. Review the report. Fill missing jurisdictions (this year: NJ, VA, PR, and ND's 2027 session) and all convene dates from NCSL. Treat projected dates as provisional.
4. Load the reviewed JSON into the session records (once those exist; until then the JSON is the record). Later in the year, re-save the Regular and Special pages to replace projected adjournments with actual ones.

The parser (`src/lib/legislatures/statenetSessions.ts`, tested) keys on the table's `data-label` attributes rather than its layout. It:

- turns `*` into `complete` and `~` into `projected`;
- accepts both `MM/DD/YYYY` and `YYYY-MM-DD` (State Net mixes them in the intro-deadline column);
- splits "House: … / Senate: …" deadlines by chamber;
- classifies rows as regular, special (including "Extraordinary" and "Extra Session") or no session ("NO REGULAR 2026 SESSION");
- reads the drafting cell ("Drafting for 2027 began: ~Prefiling may begin: ~12/01/2026") into a label, a date and a note, ignoring the template's leading `~`;
- takes a special session's subject from "RE: …" notes;
- repairs text State Net serves double-encoded (SC's "â€“" becomes "–");
- infers the page's year from session names, and flags "no session" rows left over from another year.

## Proposed model

Three collections, linked to the existing state-level `locations` record so Bills can join on location later.

### `legislatures` (one per jurisdiction: 50 states, DC, PR, US Congress)

| Field | Type | Notes |
|---|---|---|
| `location` | relationship → locations, unique | the state's Location |
| `name` | text | "General Assembly", "General Court" |
| `structure` | select: bicameral · unicameral | |
| `chambers` | array: `key` (upper · lower · unicameral), `name` ("Senate", "Assembly"), `memberTitle` ("Senator", "Delegate"), `website` | |
| `sessionPattern` | select: annual · biennial · full-time | Texas, Montana, Nevada and North Dakota have no regular session in even years |
| `website` | text (URL) | |
| `openStatesId` | text | `ocd-jurisdiction/...`, for syncing |

### `legislative-sessions`

| Field | Type | Notes |
|---|---|---|
| `legislature` | relationship | |
| `name` | text | "2026 Regular Session", "2026 1st Special Session" |
| `type` | select: regular · special · veto · interim | |
| `convenesOn` | date | from NCSL or the legislature; State Net doesn't give it |
| `adjournsOn` | date, optional | empty for full-time legislatures |
| `adjournmentBasis` | select: actual · projected · statutory deadline · meets year-round | the main protection against treating a projection as fact; State Net `~` means projected |
| `status` | text | State Net's status line, e.g. "Adjourned sine die" |
| `subject` | text | for special sessions ("Congressional maps") |
| `introDeadlines` | array: `chamber` (optional), `date` | State Net gives these per chamber |
| `governorDeadline` | date, plus `actionsComplete` checkbox | State Net `*` means all actions are complete |
| `carryover` | text, optional | e.g. "25-26": bills carry into the next year of the biennium |
| `recesses` | array: `name`, `startsOn`, `endsOn` | entered by hand; no source aggregates them |
| `keyDates` | array: `label` (crossover, etc.), `date` | optional; ties in with Bill milestones |
| `source`, `sourceUrl`, `verifiedAt` | select (State Net · NCSL · legislature · other), text, date | where the dates came from and when someone last checked |

### `legislative-committees`

| Field | Type | Notes |
|---|---|---|
| `legislature` | relationship | |
| `chamber` | select: upper · lower · joint | |
| `name` | text | |
| `type` | select: standing · select · interim · joint · subcommittee | |
| `parent` | relationship → legislative-committees | for subcommittees (Congress; states later) |
| `url` | text | official committee page |
| `urlStatus`, `urlCheckedAt` | select (ok · broken · old session), date | set by a scheduled link check |
| `active` | checkbox | committees are renamed and dissolved each session; keep old ones for historical bills |
| `openStatesId` | text, unique | `ocd-organization/...`; sync key |
| `editorLocked` | checkbox | sync never overwrites a record an editor has corrected |

Later, `Bill.committee` (free text today) could become a relationship to this collection, and `Bill.session` a relationship to `legislative-sessions`.

## Suggested next step

Import committees from openstates/people into a scratch database, run the link check, and have an editor review the flagged ~15%, before building any admin screens. For sessions, the parsed 2027 Future Sessions JSON plus NCSL convene dates and the four gaps above (NJ, VA, PR, ND) would give a complete 2027 seed.
