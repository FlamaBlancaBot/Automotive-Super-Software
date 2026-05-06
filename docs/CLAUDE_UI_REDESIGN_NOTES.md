# UI Redesign Notes

**Date:** 2026-05-05
**Redesigned by:** Claude Code (claude-sonnet-4-6)
**App version bumped to:** 1.1.009

---

## ⚠️ Warning

> **Read this note before redesigning the UI again.**
>
> The frontend has been systematically redesigned from a design system document. Do not arbitrarily change CSS variables or overwrite App.css without reading this note first.
>
> **Quote page warning:** `QuoteDetail.jsx` must NOT be rewritten without first reading `docs/CLAUDE_QUOTE_PAGE_NOTES.md`. The quote page contains fragile per-part supplier comparison logic, sticky totals, and print behaviour that must be preserved.

---

## Design Source

**Folder:** `docs/Redesign Automotive Management UI/`
**Key file:** `docs/Redesign Automotive Management UI/UI_DESIGN_SYSTEM.md`

This document is the visual/design source of truth. The design uses:
- Dark navy backgrounds (`#0a0e1a`, `#0f1420`)
- Blue-purple gradient accents (`linear-gradient(135deg, #2563eb, #9333ea)`)
- Rounded cards (`border-radius: 16px`) with subtle borders
- System font stack
- Coloured status chips with translucent backgrounds
- Icon-only sidebar (expands on hover)
- Compact top bar with search, gradient logo text, user avatar

---

## Files Changed

### CSS
- `frontend/src/index.css` — Replaced CSS variable block with refined design system palette; added gradient variables (`--gradient-primary`, `--gradient-icon-*`), semantic colour tokens, radius tokens
- `frontend/src/App.css` — Targeted improvements across all major components (see sections below); new CSS added at the bottom for `.kpiCard`, `.kpiIconBadge.*`, `.loginBrand`, `.loginIconBadge`, `.notice.*` improvements, `.emptyState`, `.activityItem`

### Components
- `frontend/src/components/TopBar.jsx` — Added user avatar (initials badge), improved layout, sticky positioning, gradient brand text
- `frontend/src/components/Sidebar.jsx` — No JSX changes; CSS handles hover-expand. Active icon now uses gradient background via `.navItem.active .navIcon`

### Pages
- `frontend/src/pages/Dashboard.jsx` — Replaced `DashboardCard` with `KpiCard` component; added icon badges with colour variants; clickable "Jobs Needing Quote" card; cleaner header
- `frontend/src/pages/Login.jsx` — Redesigned with centred brand badge, gradient icon, version display, improved form layout

### Config
- `frontend/src/config/version.js` — Bumped to `1.1.009`
- `backend/package.json` — Bumped to `1.1.009` (used by `/api/health`)

### Documentation
- `docs/CLAUDE_UI_REDESIGN_NOTES.md` — This file

---

## Design System Changes Applied

| Element | Before | After |
|---|---|---|
| Primary button | Translucent blue | Blue-purple gradient |
| Sidebar active icon | Translucent blue | Gradient badge |
| Background | `#0b1020` | `#0a0e1a` |
| Card bg | `#10182d` | `#0f1420` |
| TopBar | Gradient bg | Solid dark, sticky, box-shadow |
| Brand name | Plain white text | Gradient text (dark) / accent (light) |
| User display | Text-only pill | Avatar initials + name |
| Dashboard cards | Simple value/title | Icon badge + large KPI value |
| Login | Plain card | Centred brand badge + gradient icon |
| Search input | Inherits from `.input` | Dedicated `.topSearchInput` with focus ring |
| Tables | Basic dark | Column headers uppercase, background `--surface-2` |
| Border radius | Mixed | Standardised `10px` buttons, `16px` cards, `14px` medium |
| Modal overlay | No blur | `backdrop-filter: blur(4px)` |
| Shadows | Heavy | Subtle, only on modals and hover |
| Sidebar width | 74px | 64px collapsed, 180px hover-expanded |
| Transition timing | 0.12s | 0.15–0.18s with `cubic-bezier` |

---

## Functionality Preserved

- All API calls and workflows unchanged
- Testing user selector preserved in Login
- Quote page not touched (CSS only — no JSX changes to `QuoteDetail.jsx`)
- Parts orders, invoices, job sheets all unchanged
- Print CSS untouched
- Light/dark theme toggle preserved and improved
- Sidebar hidden items (Technicians, Suppliers, Job Sheets) remain hidden

---

## Quote Page Precautions

- `QuoteDetail.jsx` was NOT modified during this redesign
- The new CSS variables are fully backward-compatible — all `var(--separator)`, `var(--surface-1)`, `var(--muted)` etc. references in the quote page still resolve correctly
- Quote-specific classes (`.partCard`, `.supplierCell`, `.supplierPriceGrid`, `.quoteTotalsBar`, etc.) remain in App.css and were not removed or changed

---

## Notes for Future Redesigns

1. Always read this file first
2. Always read `docs/CLAUDE_QUOTE_PAGE_NOTES.md` before touching `QuoteDetail.jsx`
3. CSS variables are in `frontend/src/index.css` — change them there, not inline
4. Gradient variables are: `--gradient-primary`, `--gradient-primary-hover`, `--gradient-green`, `--gradient-icon-*`
5. From v1.1.010 the sidebar is a fixed 80px wide icon rail — no hover-expand, tooltips instead
6. The KPI card grid is responsive via CSS media queries (12→6→4→3 col spans)
7. Do not add Tailwind or a component library — this app uses custom CSS classes only
8. The app layout is `flex-row`: sidebar (80px) + `.appPanel` (flex-col containing TopBar + `.main`)
9. `lucide-react` is NOT installed — use inline SVG icons (see Sidebar.jsx)

---

## Figma visual match pass — v1.1.010

**Date:** 2026-05-06
**Version bumped to:** 1.1.010
**Reason:** Previous 1.1.009 pass was insufficient — only changed CSS tokens, dashboard cards, login, and top bar. The live app still did not visually resemble the Figma/reference UI.

### Reference files used

- `docs/Redesign Automotive Management UI/src/app/layouts/RootLayout.tsx` — app shell structure, sidebar icon rail
- `docs/Redesign Automotive Management UI/src/app/pages/Dashboard.tsx` — dashboard layout (tabs, KPI, service bay, recent jobs, alerts)
- `docs/Redesign Automotive Management UI/src/app/components/Dashboard.tsx` — panel card patterns
- `docs/Redesign Automotive Management UI/src/app/pages/Jobs.tsx` — reference job list style
- `docs/Redesign Automotive Management UI/src/styles/theme.css` — design tokens reference

### App shell changes

- **`frontend/src/App.jsx`**: Restructured layout — `<Sidebar>` is now a direct sibling of `<div.appPanel>` instead of being inside `appBody`. TopBar now lives inside `appPanel`. Removed `navCollapsed` state. TopBar receives `pageTitle={activeLabel}`. Sidebar receives `onLogout={logout}`.
- **`frontend/src/components/Sidebar.jsx`**: Completely rewritten. Removed emoji icons. Added inline SVG icon components (home, plus, search, wrench, file-text, package, clipboard-check, settings, logout). Sidebar logo is a 48×48 gradient badge with a car SVG icon. Each nav item is 48×48, rounded-xl, dark grey inactive, solid blue active. Tooltips appear to the right on hover (no hover-expand). Settings and Logout move to a `sidebarBottom` section.
- **`frontend/src/components/TopBar.jsx`**: Completely rewritten. Removed brand/logo and action buttons (Onboarding, Set-up, Logout). Shows `pageTitle` on the left. Adds a notification bell icon button. User badge shows avatar initials + name column + role.
- **`frontend/src/App.css`**: Major overhaul:
  - `.app` changed to `flex-direction: row`
  - New `.appPanel` class (flex-col, `flex: 1`)
  - `.sidebar` is now `width: 80px`, full-height (`height: 100vh`), `position: sticky; top: 0`; no hover-expand
  - New `.sidebarLogo` (48px gradient badge), `.navItem` (48×48, centred), `.navTooltip` (absolute, right of icon), `.sidebarBottom`, `.navLogout`
  - `.topBar` height increased to 64px; new `.topBarTitle`, `.topBarIconBtn`, `.topUserInfo`, `.topUserName`, `.topUserRole` classes
  - `.tabs` changed from pill buttons to border-bottom tab style
  - Mobile sidebar now overlays from `top: 0` (full viewport height)
  - Added dashboard panel CSS: `.panelCard`, `.panelCardHeader`, `.panelCardTitle`, `.panelLinkBtn`, `.dashContentGrid`, `.serviceBayGrid`, `.bayCard`, `.recentJobRow`, `.recentJobAvatar`, `.alertItem`, `.quickStatRow`, `.progressBar`, `.demoLabel`

### Dashboard changes

- **`frontend/src/pages/Dashboard.jsx`**: Major rework.
  - Tabs changed to border-bottom style (matching Figma)
  - KPI cards grid retained (8 cards, responsive)
  - Added **Service Bay Status** panel — 6 static demo bays clearly labelled "Demo"
  - Added **Recent Jobs** panel — fetches `/api/jobs?limit=5` and shows real job rows with customer initials avatar, REG, status chip
  - Added **Alerts** panel — derived from `summary` API data (jobs needing quote, parts to order, returns pending, MOT in progress)
  - Added **Workshop** quick stats panel — bay capacity progress bar, parts ordered/expected, MOT count
  - Added **Quick Actions** panel — Onboarding + Jobs Needing Quote buttons
  - All real API data preserved; service bay is the only static placeholder (clearly labelled)

### Quote page precautions

- `QuoteDetail.jsx` was NOT modified
- All quote-specific CSS classes preserved (`.partCard`, `.supplierCell`, `.supplierPriceGrid`, `.quoteTotalsBar`, `.partSupplierScroller`, etc.)
- CSS variables backward-compatible
- Supplier comparison logic, per-part scoping, sticky totals, print behaviour all untouched

### Functionality preserved

- All API calls and workflows unchanged
- Login/testing user selector preserved
- Onboarding, jobs, quotes, parts, MOT, settings, invoice, job sheet flows all intact
- Print CSS untouched
- Light/dark theme toggle preserved
- Mobile hamburger sidebar overlay preserved

---

## Figma icon + header pass — v1.1.010 (follow-up)

**Date:** 2026-05-04
**Reason:** KPI card emoji icons still looked incorrect after the initial v1.1.010 pass; dashboard lacked a header; TopBar did not show the version; Jobs rows needed a visual icon badge.

### Changes made

- **`frontend/src/pages/Dashboard.jsx`**: Replaced all emoji KPI icon strings (🔧, 📋, 📞, 📦, ⏳, 🚚, ↩️, ✅) with inline SVG icon components (`IcoWrench`, `IcoFile`, `IcoPhone`, `IcoPackage`, `IcoClock`, `IcoTruck`, `IcoRotate`, `IcoCheck`). Added dashboard header section with title ("Dashboard") and current date.
- **`frontend/src/components/TopBar.jsx`**: Imports `APP_VERSION` and renders `v{APP_VERSION}` as `.topBarVersion` next to the page title.
- **`frontend/src/pages/Jobs.jsx`**: Added `.jobRowIdCell` layout with `.jobRowBadge` (gradient wrench icon) next to the job title/number in each table row.
- **`frontend/src/App.css`**: Changed `.kpiIconBadge` to use `color: #fff` (for SVG stroke) instead of `font-size: 20px` (for emoji). Added `.dashHeader`, `.dashHeaderTitle`, `.dashHeaderDate`, `.topBarTitleGroup`, `.topBarVersion`, `.jobRowIdCell`, `.jobRowBadge` CSS classes.

### Source of truth reminder

- **`docs/Redesign Automotive Management UI/`** is the Figma visual source of truth — inspect actual TSX/CSS files, not just `UI_DESIGN_SYSTEM.md`.
- `lucide-react` is NOT installed — all icons must be inline SVG (see Sidebar.jsx and Dashboard.jsx for patterns).
- **Do NOT touch `QuoteDetail.jsx`** without reading `docs/CLAUDE_QUOTE_PAGE_NOTES.md` first.

---

## App shell Figma port — v1.1.011

**Date:** 2026-05-04
**Version bumped to:** 1.1.011
**Scope:** PHASE 1: App shell redesign only. Dashboard logic, QuoteDetail, page functionality all untouched.
**Reason:** The v1.1.010 pass was too vague and changed many things at once. This phase focuses solely on the app shell (Sidebar + TopBar) to match the Figma/reference UI visually.

### Reference files used

- `docs/Redesign Automotive Management UI/src/app/layouts/RootLayout.tsx` — icon rail structure, topbar layout, nav items

### Files changed

**`frontend/src/components/Sidebar.jsx`** — Complete rewrite.
- Replaced old prop-based nav icon system with inline SVG icon components (`IcoHome`, `IcoPlus`, `IcoSearch`, `IcoWrench`, `IcoFile`, `IcoPackage`, `IcoClipboard`, `IcoSettings`, `IcoLogout`, `IcoCar`)
- Sidebar is now a 80px wide vertical icon rail
- Logo badge at top (48×48 gradient car icon)
- Main nav items are 48×48 rounded button icons with tooltips on hover (no labels visible by default)
- Settings and Logout buttons moved to `.sidebarBottom` section
- Mobile overlay support with `.sidebarOverlay`

**`frontend/src/components/TopBar.jsx`** — Complete rewrite.
- Removed all custom brand/logo elements
- TopBar now has three sections: `.topBarLeft` (menu button + page title), `.topSearch` (search input), `.topBarRight` (bell + user badge)
- Search input hidden on mobile, shown on desktop (`@media (min-width: 900px)`)
- User badge shows initials avatar + name + role
- No version display in TopBar (kept in app shell only)

**`frontend/src/App.css`** — Sidebar + TopBar CSS rewritten.
- `.sidebar` updated for 80px icon rail with no scrollbar
- `.sidebarLogo` - 48px gradient badge with car icon
- `.sidebarNav` - flex column, no scrollbar, flex: 1 to take remaining space
- `.navItem` - 48×48 button, grey inactive, gradient active
- `.navIcon` - 20×20 icon container
- `.navTooltip` - hover tooltip to the right of icon
- `.sidebarBottom` - fixed settings + logout at bottom
- `.topBar` - three-section layout (left/middle/right)
- `.topBarLeft`, `.topBarTitle`, `.topSearch`, `.topBarRight`, `.topBarIconBtn`
- `.topUserBadge`, `.userAvatar`, `.topUserInfo`, `.topUserName`, `.topUserRole`
- `.menuButton` - hamburger shown only on mobile (`@media (max-width: 900px)`)
- Mobile sidebar overlay and slide-in animation

**`frontend/src/config/version.js`** — Bumped to `1.1.011`

**`backend/package.json`** — Bumped to `1.1.011`

### Files untouched

- **`frontend/src/pages/Dashboard.jsx`** — Dashboard logic, KPI cards, service bay, alerts all preserved. Only the shell around it changed.
- **`frontend/src/pages/QuoteDetail.jsx`** — No changes. Quote supplier comparison, sticky totals, print behaviour all untouched.
- All other pages, components, API calls, routing logic unchanged.

### Visual changes summary

| Element | Before | After |
|---|---|---|
| Sidebar width | Varied | Fixed 80px |
| Sidebar icons | Props-based generic | Inline SVG icons |
| Icon rail look | Not present | Figma-style icon rail with tooltips |
| Active icon | Translucent blue | Blue-purple gradient |
| Nav labels | Mixed | Hidden by default, tooltip on hover |
| Scrollbar in sidebar | Visible | Hidden (`scrollbar-width: none`) |
| TopBar layout | Linear (brand + title + search + user) | Three-section (left + middle + right) |
| Page title | No version | No version in TopBar (kept in app metadata) |
| Search visibility | Always shown | Hidden on mobile |
| Mobile hamburger | No | Yes, on mobile |

### Why this phase-based approach

The previous redesign attempts tried to change too many things at once (Dashboard + TopBar + sidebar + CSS tokens) which made it unclear what broke and why. By doing PHASE 1 (app shell only), we:
1. Establish a solid visual foundation matching Figma
2. Verify the shell works with all existing pages
3. Keep changes atomic and testable
4. Document the exact visual transformation for future work
5. Make it easy to identify which future changes are cosmetic vs functional

### QuoteDetail.jsx preserved

- No changes to `QuoteDetail.jsx` whatsoever
- All quote-specific CSS classes (`.partCard`, `.supplierCell`, `.supplierPriceGrid`, `.quoteTotalsBar`, etc.) untouched
- Quote logic, API calls, supplier comparison, sticky totals, print CSS all preserved
- CSS variables are backward-compatible — `var(--surface-1)`, `var(--separator)`, etc. still resolve correctly

### Recommendations for future redesign phases

1. **Phase 2:** Dashboard — reorder sections, improve KPI cards, service bay panels (if Dashboard-specific changes are needed after testing Phase 1)
2. **Phase 3:** Page visuals — improve Jobs, Parts, Settings, MOT pages to match Figma reference layouts
3. **Phase 4:** Detail pages — QuoteDetail, JobDetail, JobSheetDetail visual refinements (cautiously, after reading CLAUDE_QUOTE_PAGE_NOTES.md)
4. Always work in single-concern phases, test thoroughly before moving to the next phase
5. Keep this documentation updated as you go

---

## Dashboard Figma port — v1.1.012

**Date:** 2026-05-04
**Version bumped to:** 1.1.012
**Scope:** PHASE 2: Dashboard redesign only. QuoteDetail, quote logic, other pages untouched.
**Reason:** The Phase 1 app shell is now solid. Phase 2 focuses solely on the Dashboard visual redesign to match Figma/reference UI while preserving all live data and API behaviour.

### Reference files used

- `docs/Redesign Automotive Management UI/src/app/pages/Dashboard.tsx` — dashboard page structure, tabs, KPI layout
- `docs/Redesign Automotive Management UI/src/app/components/Dashboard.tsx` — panel components, service bay patterns
- `docs/Redesign Automotive Management UI/UI_DESIGN_SYSTEM.md` — design tokens and component patterns

### Dashboard changes

**`frontend/src/pages/Dashboard.jsx`** — Refactored visual structure while preserving all live API calls and data.
- Added `.dashOverview` wrapper for overview tab content (grid layout with sections)
- Introduced `.dashSection` pattern with `.dashSectionLabel` for section headers (uppercase labels above each section)
- **Overview KPI section**: All 8 KPI cards remain unchanged, same data loading and calculations
- **Workshop Status section**: Service bays moved into a panel card with proper section label ("Workshop Status" with "Demo" tag)
- **Activity section**: Recent Jobs + Alerts + Workshop stats reorganized into a 2-column layout on desktop
  - Recent Jobs panel: full width on mobile, left 2/3 on desktop
  - Right sidebar (1/3 on desktop): Alerts panel, Workshop stats panel, Quick Actions panel
- All API calls preserved (`/api/dashboard/summary`, `/api/jobs?limit=5`)
- All event handlers preserved (navigation clicks, filter triggers)
- Calendar and Kanban tabs completely untouched

**`frontend/src/App.css`** — Dashboard-specific CSS additions.
- `.dashboard` — max-width 100% for contained layout
- `.dashOverview` — grid layout with 24px gap between sections
- `.dashSection` — flex column with 12px gap between section label and content
- `.dashSectionLabel` — 12px uppercase muted text with proper letter spacing
- `.dashContentGrid` — responsive grid: 1 column mobile, 2 columns (2fr 1fr) desktop
- `.dashContentRight` — flex column for right sidebar (alerts, stats, actions)
- `.recentJobsList` — flex column, no gap (rows stack directly)
- `.alertsList` — flex column, alert items connected with shared borders
- `.workshopStats` — flex column container for stat rows with dividers
- `.quickActionsGrid` — grid layout for action buttons, full width
- Service bay grid responsive: 2 cols (mobile) → 3 cols (tablet) → 6 cols (desktop)

**`frontend/src/config/version.js`** — Bumped to `1.1.012`

**`backend/package.json`** — Bumped to `1.1.012`

### Live data preservation

- KPI cards: All 8 cards with live `/api/dashboard/summary` data — no changes to calculations or labelling
- Recent Jobs: Fetches from `/api/jobs?limit=5` — styling improved, data unchanged
- Alerts: Generated from summary data — same logic as before, improved visual presentation
- Workshop stats: Bay capacity calculation, parts counts, MOT counts — all logic preserved
- All navigation handlers (job clicks, quick action buttons) preserved exactly

### QuoteDetail.jsx preservation

- ✅ **NOT MODIFIED** — No changes whatsoever
- Quote supplier comparison logic untouched
- Sticky totals layout preserved
- Print behaviour intact
- All quote CSS classes (`.partCard`, `.supplierCell`, `.supplierPriceGrid`, etc.) untouched

### Service Bay Status note

Service Bay panel is marked with a "Demo" label. The 6-bay configuration is UI-only placeholder data (not backed by a backend bay model). If a future phase adds backend bay tracking, this section can be updated to show real bay data without breaking anything else.

### Files unchanged

- ✅ `frontend/src/pages/QuoteDetail.jsx` — no changes
- ✅ `frontend/src/pages/Calendar.jsx` — imported as-is
- ✅ `frontend/src/pages/Kanban.jsx` — imported as-is
- ✅ Backend routes — no changes to backend logic

---

## Jobs and Job Detail Figma port — v1.1.013

**Date:** 2026-05-06
**Version bumped to:** 1.1.013
**Scope:** PHASE 3: Jobs and JobDetail page redesign only. QuoteDetail, Dashboard, other pages untouched.
**Reason:** The Phase 1 (app shell) and Phase 2 (dashboard) are now solid. Phase 3 focuses on the Jobs and Job Detail pages to match Figma/reference UI while preserving all live data and functionality.

### Reference files used

- `docs/Redesign Automotive Management UI/src/app/pages/Jobs.tsx` — jobs page layout, search, filters, table
- `docs/Redesign Automotive Management UI/src/app/pages/JobDetail.tsx` — job detail header, info cards, activity timeline, actions sidebar
- `docs/Redesign Automotive Management UI/UI_DESIGN_SYSTEM.md` — design tokens and component patterns

### Files changed

**`frontend/src/pages/Jobs.jsx`** — Visual and structural overhaul.
- New header section with "Jobs" title, subtitle, and "New Job" button (aligned to Figma reference)
- Search box redesign: inline Search icon, placeholder text matching Figma, Filter button
- Results section with filter tabs: All, Today, Needs Quote, Waiting Parts, In Progress, Completed
- Table redesign with Job ID badge (gradient icon), Customer, Vehicle, Service, Status chip, Booked date, Quote status, Parts status, Actions
- View Details button in actions column (replaces dual "View" + "Create quote" buttons in one row)
- All API calls preserved (`/api/jobs`, search params, filter logic, create/open quote functionality)
- StatusChip components and VehicleHeader component unchanged in functionality

**`frontend/src/pages/JobDetail.jsx`** — Major structural reorganization.
- New header: Back button, "Job {ID}" title, service subtitle, "Create Quote" button (matches Figma header style)
- 3-column grid layout (2-col main, 1-col sidebar):
  - **Main (left):**
    - Job Information card: Status, Priority, Customer, Vehicle, REG, Phone in 2-column grid
    - Activity Timeline card: Blue marker dots, entry text, timestamp + user meta
  - **Sidebar (right):**
    - Quick Actions card: Create Quote, View Job Sheet, Create Invoice buttons (full width)
    - Summary card: Booked start/end times
- Below the grid layout, preserved sections (unchanged in function but with new section styling):
  - Notes section (Customer Notes, Internal Notes)
  - Quotes section (quoted unchanged, added View/Open buttons)
  - Job Sheet section (Technician, Mileage in/out, Quote, Checklist, Notes, Sign-off)
  - Invoices section (table with invoice number, status, subtotal, total)
  - Parts orders section (status, part, supplier, qty, ETA, invoice number)
- All API calls preserved: `/api/jobs/{id}`, `/api/jobs/{id}/invoices`, `/api/jobs/{id}/job-sheet`, `/api/activity`
- All action handlers preserved: createOrOpenQuote, createOrOpenInvoice, onOpenJobSheet, onViewPartsOrders, onBackToJobs
- Activity timeline data unchanged, just visually restructured

**`frontend/src/App.css`** — New Jobs and JobDetail CSS classes.
- `.jobsPageHeader` — flex row, title + New Job button
- `.jobsPageTitle`, `.jobsPageSubtitle` — title styling
- `.jobsSearchCard` — card wrapper with flexbox layout
- `.jobsSearchInput` — input with inline Search icon (absolute positioned)
- `.jobsResultsCard` — results container
- `.jobsFilterTabs` — flex row of filter buttons, active state uses gradient background
- `.jobsTableWrapper`, `.jobsTable` — dark-themed table with headers, hover effects
- `.jobIdCell`, `.jobIdBadge` — gradient badge with icon for job ID
- `.jobCustomerCell`, `.jobVehicleCell`, `.jobServiceCell`, `.jobBookedCell`, `.jobActionsCell` — table cell styling
- `.jobDetailHeader` — back button, title content, create quote button layout
- `.headerBackBtn` — back button styling with hover state
- `.jobDetailTitle`, `.jobDetailSubtitle` — header text styling
- `.jobDetailGrid` — 2-col grid (responsive to 1 col on mobile)
- `.jobDetailMain`, `.jobDetailSidebar` — flex column containers
- `.jobDetailCard` — card styling with dark border
- `.jobDetailCardTitle` — section header styling
- `.jobDetailInfoGrid` — 2-col grid for job info fields (responsive)
- `.jobDetailLabel`, `.jobDetailValue`, `.jobDetailValue.mono` — field label/value styling
- `.activityTimelineList`, `.activityTimelineItem`, `.activityTimelineMarker`, `.activityTimelineContent` — timeline visual elements
- `.jobDetailActionsList` — flex column for action buttons
- `.jobDetailSummaryList`, `.jobDetailSummaryRow` — summary info layout
- `.jobDetailSection`, `.jobDetailSectionTitle` — section card styling
- `.jobDetailNotesGrid`, `.jobDetailNoteField` — notes section grid layout
- Dark theme with proper borders, separators, text contrast

**`frontend/src/config/version.js`** — Bumped to `1.1.013`

**`backend/package.json`** — Bumped to `1.1.013`

**`docs/CLAUDE_UI_REDESIGN_NOTES.md`** — This file, appended with Phase 3 documentation

### Live data preservation

- Jobs page: All API calls, search/filter logic, create/open quote functionality preserved
- JobDetail page: All job data loading, quote/invoice/parts/jobsheet fetching unchanged
- Status chips, vehicle headers, customer names, booking dates — all real data, styled visually
- No fake or placeholder data (except UI-only section labels)
- Activity timeline: Fetches from `/api/activity` endpoint, displays real activity entries

### QuoteDetail.jsx preservation

- ✅ **NOT MODIFIED** — Zero changes to `frontend/src/pages/QuoteDetail.jsx`
- All quote supplier comparison, sticky totals, print behaviour untouched
- All quote CSS classes preserved in App.css

### Backend unchanged

- ✅ No changes to backend routes, models, or API logic
- Jobs listing, job detail, quotes, invoices, parts orders, job sheet routes all unchanged
- Activity logging untouched

### What future phases should handle

1. **Phase 4**: Other operational pages (Parts list, MOT, Settings) to match Figma visual style
2. **Phase 5**: Detail pages (QuoteDetail, InvoiceDetail, JobSheetDetail) — cautiously, after reading CLAUDE_QUOTE_PAGE_NOTES.md
3. **Phase 6**: Onboarding and Intake pages
4. Light mode refinements — all new CSS uses semantic color tokens, so light mode should inherit automatically (test required)

### Files untouched

- ✅ `frontend/src/pages/QuoteDetail.jsx`
- ✅ `frontend/src/pages/Dashboard.jsx`
- ✅ `frontend/src/pages/Parts.jsx`
- ✅ `frontend/src/pages/Settings.jsx`
- ✅ `frontend/src/pages/MOT.jsx`
- ✅ `frontend/src/pages/Onboarding.jsx`
- ✅ `frontend/src/pages/Login.jsx`
- ✅ Backend routes
- ✅ All API calls and data loading — preserved
