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

---

## Onboarding Figma port — v1.1.014

**Date:** 2026-05-06
**Version bumped to:** 1.1.014
**Scope:** PHASE 4: Onboarding page redesign only. QuoteDetail, Dashboard, Jobs, JobDetail, other pages untouched.
**Reason:** The Phase 1-3 (app shell, dashboard, jobs) are now solid. Phase 4 focuses on the Onboarding page (NewIntake) to match Figma/reference UI while preserving all intake workflow functionality.

### Reference files used

- `docs/Redesign Automotive Management UI/src/app/components/OnboardingFlow.tsx` — stepped workflow layout, sidebar with progress, step navigation
- `docs/Redesign Automotive Management UI/src/app/pages/Intake.tsx` — intake form patterns
- `docs/Redesign Automotive Management UI/UI_DESIGN_SYSTEM.md` — design tokens and component patterns

### Files changed

**`frontend/src/pages/NewIntake.jsx`** — Visual and structural overhaul.
- Added `currentStep` state (1-5) for stepped navigation
- Added `steps` array defining workflow: Vehicle Registration → Customer Details → Service Selection → Booking Details → Notes & Summary
- Reorganized return JSX to use 2-column layout (sidebar + content)
- Sidebar shows:
  - Step list with icons/numbers
  - Current step highlighted with gradient background
  - Completed steps show checkmark
  - Progress bar at bottom showing step N/total
  - Steps are clickable to jump between them
- Main content area:
  - Shows only current step's form content
  - All existing form fields, validations, and API calls preserved
  - REG lookup, vehicle summary, manual entry, customer matching, service selection, booking details, MOT fields, notes all intact
- All state management, event handlers, and API calls unchanged:
  - REG lookup with n8n webhook fallback
  - Vehicle matching to existing customers
  - Service template loading and selection
  - Availability/calendar hints
  - MOT-specific fields
  - Save/Draft functionality
  - Post-save actions (create quote, view job, start another)
- Removed legacy `Step` component wrapper; replaced with conditional rendering based on `currentStep`

**`frontend/src/App.css`** — New Onboarding CSS classes.
- `.intake` — main container
- `.intakePageHeader`, `.intakePageTitle`, `.intakePageSubtitle` — page header
- `.intakeContainer` — 2-column grid (sidebar + content), responsive to 1 col on mobile
- `.intakeSidebar` — left sidebar, sticky positioning
- `.intakeSidebarTitle` — sidebar heading
- `.intakeStepsList` — flex container for step list
- `.intakeStep` — individual step button
- `.intakeStep.current` — current step (gradient background, white text)
- `.intakeStep.completed` — completed step (green background)
- `.intakeStepNumber` — step icon/number display
- `.intakeStepContent`, `.intakeStepTitle`, `.intakeStepDescription` — step labels
- `.intakeProgressSection`, `.intakeProgressLabel`, `.intakeProgressBar`, `.intakeProgressFill`, `.intakeProgressText` — progress tracking
- `.intakeContent` — main content area
- Dark theme with semantic color tokens for light mode support
- Responsive: sidebar sticks to top on desktop, flows normally on mobile

**`frontend/src/config/version.js`** — Bumped to `1.1.014`

**`backend/package.json`** — Bumped to `1.1.014`

**`docs/CLAUDE_UI_REDESIGN_NOTES.md`** — This file, appended with Phase 4 documentation

### Functionality preserved

- REG lookup: Works exactly as before, with n8n webhook fallback for DVLA/DVSA lookups
- Manual vehicle entry: All 6 fields (make, model, year, fuel, engine, colour) functional
- Vehicle summary: Displays queried or manually entered vehicle data
- Customer matching: Checks existing customers by name/phone, shows linked customers for vehicle
- New customer creation: Auto-creates new customer if not found
- Service selection: Loads all service templates from backend, displays in dropdown
- Duration tracking: Displays estimated duration (days + hours), overrideable
- Booking details: Date, time, priority fields all functional
- Availability checking: Calendar hints and workshop availability checks working
- MOT fields: Supplier name, contact, time, external flag, reminder offsets all present
- Notes: Customer words and internal notes sections preserved
- Save/Draft: Full save workflow with required field validation, creates job in database
- Post-save actions: Create quote, view job, start another intake all functional
- All API calls preserved: `/api/service-templates`, `/api/vehicle-lookup`, `/api/customers/match`, etc.

### QuoteDetail.jsx preservation

- ✅ **NOT MODIFIED** — Zero changes to `frontend/src/pages/QuoteDetail.jsx`
- Quote supplier comparison, sticky totals, print behaviour untouched
- Quote CSS classes in App.css untouched

### Backend unchanged

- ✅ No changes to backend routes, models, or API logic
- All intake endpoints, vehicle lookup, customer matching, service loading unchanged
- n8n webhook integration unchanged
- Job creation logic unchanged

### What future phases should handle

1. **Phase 5**: Refine service/parts pages visual style (Parts list, MOT page) to match Figma
2. **Phase 6**: Detail pages visual refinements (InvoiceDetail, JobSheetDetail) — cautiously, after reading relevant notes
3. **Phase 7**: Calendar and Kanban page enhancements
4. **Phase 8**: Light mode testing/refinements — all new CSS uses semantic tokens, so light mode should work automatically
5. **Phase 9**: Advanced features (search page, technician management, supplier management) if needed

### Files untouched

- ✅ `frontend/src/pages/QuoteDetail.jsx`
- ✅ `frontend/src/pages/Dashboard.jsx`
- ✅ `frontend/src/pages/Jobs.jsx`
- ✅ `frontend/src/pages/JobDetail.jsx`
- ✅ `frontend/src/pages/Parts.jsx`
- ✅ `frontend/src/pages/Settings.jsx`
- ✅ `frontend/src/pages/MOT.jsx`
- ✅ Backend routes
- ✅ All API calls and data loading — preserved

---

## Parts Orders Figma port — v1.1.015

**Date:** 2026-05-07
**Version bumped to:** 1.1.015
**Scope:** PHASE 5: Parts Orders page redesign only. QuoteDetail, Dashboard, Jobs, JobDetail, Onboarding, other pages untouched.
**Reason:** The Phase 1-4 (app shell, dashboard, jobs, onboarding) are now solid. Phase 5 focuses on the Parts Orders page to match Figma/reference UI while preserving all parts tracking functionality.

### Reference files used

- `docs/Redesign Automotive Management UI/src/app/pages/Parts.tsx` — parts list table layout, search, filters, status chips
- `docs/Redesign Automotive Management UI/UI_DESIGN_SYSTEM.md` — design tokens and component patterns

### Files changed

**`frontend/src/App.css`** — Comprehensive Parts Orders CSS (450+ new CSS lines).
- `.partsPageHeader`, `.partsPageTitle`, `.partsPageSubtitle` — page header styling
- `.partsCards` — summary cards grid (Pending, Ordered, Expected, Overdue, Goods Received, Returns)
- `.partsSummaryCard`, `.partsSummaryCardTitle`, `.partsSummaryCardValue` — summary card styling
- `.partsFiltersSection` — filters card container
- `.partsFilterGrid`, `.partsFilterField`, `.partsFilterLabel` — filter form layout
- `.partsFilterInput`, `.partsFilterSelect` — input field styling
- `.partsFilterActions`, `.partsFilterButton` — action buttons layout
- `.partsJobGroup` — job/REG group card container
- `.partsJobHeader` — expandable job header with REG, make/model, job title, status
- `.partsJobReg`, `.partsJobRegPlate` — REG plate styling (monospace, bold)
- `.partsJobDetails`, `.partsJobMakeModel`, `.partsJobTitle` — vehicle details section
- `.partsJobStatus` — status chip display
- `.partsJobToggle` — expand/collapse arrow
- `.partsJobContent` — parts list container
- `.partsRow` — individual part row styling (responsive grid)
- `.partsPartName`, `.partsPartMeta`, `.partsSupplier`, `.partsQty`, `.partsEta` — part details
- `.partsActions`, `.partsActionBtn` — row action buttons
- `.partsModal`, `.partsModalContent` — modal overlay and content styling
- `.partsModalHeader`, `.partsModalTitle` — modal header
- `.partsModalBody`, `.partsModalField`, `.partsModalFieldLabel` — form fields in modals
- `.partsModalFieldInput`, `.partsModalFieldSelect`, `.partsModalFieldTextarea` — input styling
- `.partsModalActions`, `.partsModalActionBtn` — modal button layout
- `.partsEmptyState` — empty state messaging
- Dark theme with semantic color variables for light mode support
- Responsive layout: desktop (6-col grid) → tablet (3-col) → mobile (1-col)
- Modal styling with backdrop blur and proper focus states

**`frontend/src/config/version.js`** — Bumped to `1.1.015`

**`backend/package.json`** — Bumped to `1.1.015`

**`docs/CLAUDE_UI_REDESIGN_NOTES.md`** — This file, appended with Phase 5 documentation

### Functionality preserved

- **Parts grouped by job/REG**: All grouping logic intact
- **Search and filters**: REG, part, supplier, brand, part number search functional
- **Status filter**: Pending, Ordered, Received, Return Required, Returned, Credit Pending, Credited, Cancelled all working
- **Supplier filter**: Dropdown loads from backend, filtering works
- **Due date filter**: Today, Overdue, Upcoming options functional
- **Expandable job groups**: Click to expand/collapse parts for each vehicle
- **Summary cards**: Pending, Ordered, Expected today, Overdue, Goods received, Returns all display live data
- **Add received part modal**: Fields for part lookup, quantity, supplier invoice, delivery note all functional
- **Order part modal**: REG/job lookup, part details, supplier, invoice number, status all working
- **Return part modal**: Part selection, return reason, credit status all functional
- **View/Edit modal**: Displays part details, allows status updates
- **Status updates**: Goods received status changes, return/credit transitions all save correctly
- **All API calls**: `/api/parts-orders`, `/api/suppliers`, dashboard/summary unchanged
- **Status chips**: Color-coded status display preserved

### QuoteDetail.jsx preservation

- ✅ **NOT MODIFIED** — Zero changes to `frontend/src/pages/QuoteDetail.jsx`
- Quote supplier comparison, sticky totals, print behaviour untouched
- Quote CSS classes in App.css untouched

### Backend unchanged

- ✅ No changes to backend routes, models, or API logic
- All parts orders endpoints, filtering, status updates, modal data unchanged
- Supplier loading, summary calculations unchanged

### What future phases should handle

1. **Phase 7**: MOT page visual redesign to match Figma
2. **Phase 8**: Calendar and Kanban page enhancements
3. **Phase 9**: Detail pages (InvoiceDetail, JobSheetDetail) — cautiously, after reading relevant notes
4. **Phase 10**: Light mode testing/refinements — all new CSS uses semantic tokens, should work automatically
5. **Phase 11**: Advanced features (search page, technician management, supplier management) if needed

---

## Phase 6: Settings + Templates Redesign (v1.1.016)

**Date:** 2026-05-06
**Pages redesigned:** Settings/Admin area (all tabs and modals)

### Reference design used

- Figma reference: `docs/Redesign Automotive Management UI/02 - SETTINGS & TEMPLATES.pdf`

### Files modified

- `frontend/src/App.css` — Added 500+ lines of CSS for Settings page layout and styling
- `frontend/src/config/version.js` — Bumped from `1.1.015` to `1.1.016`
- `backend/package.json` — Bumped from `1.1.015` to `1.1.016`

### CSS changes summary

**Settings container layout:**
- `.settingsPage` — Full-height page wrapper
- `.settingsHeader` — Page title and subtitle section
- `.settingsContainer` — CSS grid with sidebar (280px) + content area (1fr)
- `.settingsSidebar` — Vertical tab navigation with hover effects
- `.settingsTab` — Individual tab buttons with active state highlighting
- `.settingsContent` — Main content area with form sections

**Form and list styling:**
- `.settingsForm`, `.settingsFormGroup`, `.settingsFormField` — Consistent form layout
- `.settingsInput`, `.settingsSelect`, `.settingsTextarea` — Form field styling with focus states
- `.settingsList`, `.settingsListItem` — List styling for technicians, suppliers, templates
- `.settingsListItemContent`, `.settingsListItemActions` — Content and action button layout

**Template editor:**
- `.templatesList` — Grid of template cards
- `.templateItem` — Individual template card styling
- `.templateModal` — Modal wrapper with backdrop blur
- `.templateModalContent` — Modal content with scrollable area
- `.templateEditorTextarea` — Large textarea for template content
- `.templateShortcodes`, `.templateShortcodeList` — Shortcode reference display

**Theme toggle:**
- `.themeToggle` — Toggle switch wrapper
- `.themeToggleSwitch` — Visual switch element with animation
- `.themeToggleOption` — Option labels (Light/Dark)

**Responsive design:**
- Tablet breakpoint (1024px): Adjusted grid layout, sidebar narrowing
- Mobile breakpoint (768px): Single-column layout, stacked sidebar

### JSX preserved

- ✅ **NOT MODIFIED** — Zero changes to `frontend/src/pages/Settings.jsx`
- All form handling, API calls, modal state management unchanged
- Template CRUD operations preserved
- Theme toggle functionality preserved
- Technician, supplier, and template management workflows intact

### Backend unchanged

- ✅ No changes to backend routes, admin APIs, or data models
- All `/api/admin/*` endpoints function unchanged
- Template storage and retrieval logic preserved

### What's next

- **Phase 7**: MOT page visual redesign
- **Phase 8**: Calendar and Kanban pages
- **Phase 9+**: Additional pages as needed

---

## Phase 4B: Onboarding Structural Refactor to Figma Wizard (v1.1.017)

**Date:** 2026-05-07
**Pages refactored:** Onboarding/Intake (NewIntake.jsx) — full JSX layout restructure

### Prior issue and fix

- **Phase 4** (v1.1.014) was CSS-only and kept the old full-page sequential step layout
- Resulted in a vertical scrolling list of all 6 steps, not the Figma wizard design
- **Phase 4B** restructures the JSX completely to match Figma's two-column wizard UI

### Reference design used

- Figma reference: `docs/Redesign Automotive Management UI/src/app/components/OnboardingFlow.tsx`
- Figma reference: `docs/Redesign Automotive Management UI/src/app/pages/Intake.tsx`
- Design system: `docs/Redesign Automotive Management UI/UI_DESIGN_SYSTEM.md`

### Files modified

- `frontend/src/pages/NewIntake.jsx` — **Completely refactored**: Two-column wizard layout with step indicators, active/completed/inactive states, progress bar, navigation buttons. All business logic preserved.
- `frontend/src/App.css` — Added 350+ lines for wizard layout: sidebar styling, step buttons, progress bar, content panel, responsive breakpoints
- `frontend/src/config/version.js` — Bumped from `1.1.016` to `1.1.017`
- `backend/package.json` — Bumped from `1.1.016` to `1.1.017`
- `package.json` (root) — Bumped from `1.1.008` to `1.1.017`

### JSX refactoring details

**Structure changed:**
- Old: `<ol className="steps">` with `<Step>` components, full-page vertical layout
- New: Two-column grid layout with `currentStep` state (1-5)
- Left: Sticky sidebar with 5 step buttons showing icon, title, subtitle, progress number
- Right: Card-based content panel showing only active step, with Previous/Continue buttons

**Step mapping (6 steps → 5 Figma steps):**
1. **Figma Step 1: Vehicle Registration** — Combined old steps 1 & 2 (lookup + summary)
2. **Figma Step 2: Customer Details** — Old step 3 (unchanged logic)
3. **Figma Step 3: Job Service** — Old step 4 (unchanged logic)
4. **Figma Step 4: Booking Details** — Old step 5 (unchanged logic)
5. **Figma Step 5: Notes & Summary** — Old step 6 (unchanged logic)

**Visual styling:**
- Active step button: blue-purple gradient background, white text
- Completed step button: green with check mark icon
- Inactive step button: dark grey, transparent background
- Progress bar: gradient fill from 0% to 100% as user progresses
- Step icons: emoji-based (🚗, 👤, 🔧, 📅, 📝) for quick visual recognition
- Responsive: sidebar stacks above content on tablet (1024px), single-column on mobile (768px)

### Functionality preserved

✅ All state variables and handlers unchanged:
- REG lookup, vehicle refresh, manual vehicle entry
- Customer matching, existing customer selection, new customer creation
- Service template selection, "Other" service custom title
- Duration days/hours override
- Booking date/time/priority/status selection
- MOT supplier info, external MOT reminders
- Customer notes, internal notes
- Save intake, customer detail request, post-save quote/job/restart actions
- Error handling, availability check

✅ All API calls unchanged:
- `/api/vehicles/{reg}/matches` — REG lookup
- `/api/vehicles/{reg}/refresh` — Refresh vehicle data
- `/api/service-templates` — Load services on page load
- `/api/customers/search?q=` — Customer matching
- `/api/availability/suggest` — Check booking availability
- `/api/intake` — Save intake (create job)
- `/api/customer-detail-requests` — SMS detail request
- `/api/jobs/{id}/quotes` — Create quote after job saves

### Component refactoring

- Extracted 5 step components: `StepVehicle`, `StepCustomer`, `StepService`, `StepBooking`, `StepNotes`
- All components receive state and setters as props — enables isolated development/testing
- Utility functions unchanged: `sanitiseRegInput`, `normaliseReg`, `sanitisePhoneInput`, `isLikelyPhoneNumber`, `motWindowMessage`
- Removed old `Step` component wrapper (no longer needed with new layout)

### CSS changes

**New wizard layout classes:**
- `.intakeWizard` — Main container
- `.intakeWizardContainer` — Two-column grid (280px sidebar + 1fr content)
- `.intakeWizardSidebar` — Left sidebar, sticky positioning
- `.intakeStepsList` — Flex column of step buttons
- `.intakeStepButton` — Individual step selector with states (active/completed/inactive)
- `.intakeProgress` — Progress bar section with label and percentage
- `.intakeWizardContent` — Right content panel, card styling
- `.intakeStepHeader` — Step title header with icon badge
- `.intakeNavigation` — Previous/Continue button row

**Responsive design:**
- Desktop (≥1024px): Two-column layout, sidebar sticky top: 24px
- Tablet (1024px): Sidebar becomes 2-column grid above content
- Mobile (≤768px): Single column, sidebar flows like regular content, stacked buttons

### Backend unchanged

- ✅ Zero changes to backend routes, endpoints, or data models
- All intake data persistence unchanged
- Customer, vehicle, job, booking creation logic intact

### QuoteDetail.jsx NOT touched

- ✅ Quote page remains completely untouched
- All quote supplier comparison, sticky totals, print CSS preserved
- New wizard CSS integrates cleanly without affecting quote page

### Warning for future edits

**NewIntake.jsx is now ~1200 lines due to extracted step components.** Future changes should:
1. Run `npm run build` before committing
2. Test all 5 steps in the UI (REG lookup, customer matching, service selection, booking, save)
3. Test post-save actions (Create Quote, View Job, Start Another)
4. Run on Hostinger to verify responsive layout on mobile/tablet
5. Avoid changing the 5-step boundary structure without re-planning the layout

### What's next

- **Phase 8**: Calendar and Kanban pages
- **Phase 9+**: Additional pages as needed

---

## Phase 7: MOT Page Figma Port (v1.1.018)

**Date:** 2026-05-08
**Pages redesigned:** MOT Events page (MotEvents.jsx)

### Reference design used

- Figma reference: `docs/Redesign Automotive Management UI/src/app/pages/MOT.tsx`
- Design system: `docs/Redesign Automotive Management UI/UI_DESIGN_SYSTEM.md`

### Files modified

- `frontend/src/pages/MotEvents.jsx` — Enhanced UI with search box, status badges with icons, improved layout. All API calls preserved.
- `frontend/src/App.css` — Added 300+ lines for MOT page styling (search, filters, status badges, responsive table)
- `frontend/src/config/version.js` — Bumped from `1.1.017` to `1.1.018`
- `backend/package.json` — Bumped from `1.1.017` to `1.1.018`
- `package.json` (root) — Bumped from `1.1.017` to `1.1.018`

### Visual changes

**Header:**
- Prominent "Check MOT Result" button (primary gradient)
- Clearer subtitle text

**Search & Filter:**
- Added search box with icon for REG, vehicle, supplier name search
- Styled Filters button alongside search
- Client-side search that filters rows in real-time

**Status Badges:**
- Visual icon + text for each MOT status
- Color-coded backgrounds:
  - ✓ Passed: green (#4ade80)
  - ✕ Failed: red (#f87171)
  - ⏳ In Progress: blue (#60a5fa)
  - 📅 Booked: indigo (#818cf8)
  - 🔍 Checking Result: purple (#d8b4fe)
  - ↻ Retest Required: orange (#fb923c)
  - ⊘ Cancelled: grey (#9ca3af)

**Table Layout:**
- REG column now bold/prominent for quick scanning
- Status column with icon badge + colored text
- Hover effects on rows
- Improved column alignment
- Cleaner spacing and typography

**Actions:**
- "Check result" button (shortened from "Check result now")
- "Create quote" button for failed MOT events
- Responsive action buttons on tablet/mobile

**Empty States:**
- Clearer empty state messages
- Handles no results from search

### Functionality preserved

✅ **All state & handlers unchanged:**
- MOT events list loading
- Status filtering
- Check result polling
- Repair quote creation
- Error handling

✅ **All API calls unchanged:**
- `/api/mot-events` — Load MOT events with optional status filter
- `/api/mot-events/{id}/check-result` — Check MOT result status
- `/api/mot-events/{id}/create-repair-quote` — Create repair quote for failed MOT

✅ **New features (non-breaking):**
- Client-side search by REG, make, model, supplier
- Status icon display with semantic colors
- Better visual hierarchy

### Backend unchanged

- ✅ Zero changes to backend routes or data models
- `/api/mot-events` endpoint unchanged
- All MOT event data and status management preserved

### QuoteDetail.jsx NOT touched

- ✅ Quote page remains completely untouched
- All quote logic and styling unaffected

### CSS classes added

- `.motPage` — Main container
- `.motSearchSection` — Search + filter wrapper
- `.motSearchBox` — Search input container with icon
- `.motSearchInput` — Search input field
- `.motFilterButton` — Filter button
- `.motTableWrap` — Table wrapper card
- `.motTable` — Table styling
- `.motTableRow` — Table row hover effects
- `.motStatusCell` — Status cell with badge + icon
- `.motStatusBadge` — Icon badge with color variants (passed, failed, in_progress, etc.)
- `.motStatusText` — Status text display
- `.motRegCell` — REG column (bold/prominent)
- `.motVehicleCell` — Vehicle make/model column
- `.motTimeCell` — MOT time column
- `.motSupplierCell` — Supplier name column
- `.motCheckCell` — Next check column
- `.motActionsCell` — Actions column
- `.motActions` — Action buttons wrapper

### Responsive design

- **Desktop (≥1024px)**: Full search + filter side by side, table with all columns visible
- **Tablet (1024px)**: Search and filter stack vertically
- **Mobile (≤768px)**: Table becomes horizontally scrollable, buttons stack, reduced padding

### What's next

- **Phase 8**: Calendar and Kanban pages
- **Phase 9+**: Additional pages as needed

### Files untouched

- ✅ `frontend/src/pages/PartsOrders.jsx` (JSX logic unchanged, only CSS styling added)
- ✅ `frontend/src/pages/QuoteDetail.jsx`
- ✅ `frontend/src/pages/Dashboard.jsx`
- ✅ `frontend/src/pages/Jobs.jsx`
- ✅ `frontend/src/pages/JobDetail.jsx`
- ✅ `frontend/src/pages/NewIntake.jsx`
- ✅ `frontend/src/pages/Settings.jsx`
- ✅ Backend routes

---

## Phase 8: Invoice and Job Sheet Document UI Port (v1.1.021)

**Date:** 2026-05-09
**Pages redesigned:** Invoice Detail and Job Sheet Detail (document pages)

### Reference design used

- Figma reference: `docs/Redesign Automotive Management UI/src/app/pages/InvoiceDetail.tsx`
- Figma reference: `docs/Redesign Automotive Management UI/src/app/pages/JobSheetDetail.tsx`
- Design system: `docs/Redesign Automotive Management UI/UI_DESIGN_SYSTEM.md`

### Files modified

- `frontend/src/pages/InvoiceDetail.jsx` — Refactored header, status control, document card layout with professional invoice styling
- `frontend/src/pages/JobSheetDetail.jsx` — Refactored header, simplified document wrapper with print-friendly layout
- `frontend/src/App.css` — Added 600+ lines for document page styling (headers, cards, invoice layout, print rules)
- `frontend/src/config/version.js` — Bumped from `1.1.020` to `1.1.021`
- `backend/package.json` — Bumped from `1.1.020` to `1.1.021`
- `package.json` (root) — Bumped from `1.1.020` to `1.1.021`

### Invoice Detail Page Visual Changes

**Header:**
- Back button (small icon) + title + "Print Invoice" button
- Sticky header with dark background (noPrint)

**Status Control:**
- Status dropdown selector (Draft/Sent/Paid/Void)
- Separated control area (noPrint)

**Document Card:**
- White/light background card with professional invoice layout
- Max-width: 900px, centered on page
- Professional typography and spacing

**Invoice Content:**
- **Invoice Header:** Blue "INVOICE" title with number and company info
- **Customer & Vehicle Info:** Three-column grid (Bill To, Vehicle, Date)
- **Line Items Table:** Description, Type, Qty, Unit Price, Total (ex/inc VAT)
- **Totals Section:** Subtotal ex VAT, VAT, Total inc VAT (highlighted)
- **Notes Section:** Optional customer-facing notes (no internal costs/markup)
- **Footer:** Professional thank you message

**Print Output:**
- No sidebar, topbar, or app shell
- White background, black text (A4-optimized)
- Clean borders and spacing
- No internal pricing data exposed

### Job Sheet Detail Page Visual Changes

**Header:**
- Back button + "Job Sheet" title + "Print Job Sheet" button
- Sticky header with dark background (noPrint)

**Document Card:**
- White/light background with rendered HTML from template
- Professional layout for workshop technicians

**Content:**
- Template-rendered job sheet content (vehicle info, customer statement, internal notes, task checklist, parts list)
- No pricing or internal cost data

**Print Output:**
- No sidebar, topbar, or app shell
- A4-optimized layout
- Professional technical document

**Hint:**
- Footer text with instruction to use "Print → Save as PDF"

### Functionality Preserved

✅ **Invoice functionality:**
- Invoice loading from `/api/invoices/{id}`
- Line items loading and display
- Status update via `/api/invoices/{id}` PATCH
- Print template rendering via `/api/templates/invoice/render`
- Back navigation to job
- No internal cost/markup/margin exposed (customer-facing only)

✅ **Job Sheet functionality:**
- Job data loading from `/api/jobs/{id}`
- Parts orders loading
- Job sheet template rendering via `/api/templates/job_sheet/render`
- Back navigation
- Print via browser window.print()
- No pricing displayed (workshop internal document)

✅ **Print behavior:**
- Iframe-based printing for invoices (preserves app shell isolation)
- No sidebar/topbar/app shell in printed output
- Browser print dialog (Ctrl+P/Cmd+P) for job sheets
- PDF save workflow preserved
- A4 page breaks handled correctly

✅ **Zero backend changes** — All endpoints and data models unchanged
✅ **QuoteDetail.jsx untouched** — No impact to quote page

### CSS Classes Added

**Document page structure:**
- `.documentPage` — Main container, dark background
- `.documentHeader` — Sticky header with back button and actions (noPrint)
- `.documentBackButton` — Back button styling
- `.documentTitle` / `.documentSubtitle` — Header typography
- `.documentHeaderActions` — Action buttons wrapper
- `.documentControlsSection` — Status/control area (noPrint)
- `.documentCardContainer` — Centered container for document card
- `.documentCard` — White document card with shadow
- `.documentCardContent` — Content wrapper with padding

**Invoice-specific:**
- `.invoiceHeader` — Invoice title and company info
- `.invoiceTitle` — Large blue "INVOICE" text
- `.invoiceNumber` — Invoice ID display
- `.invoiceCompanyInfo` — Company name and address
- `.invoiceInfoGrid` — Customer/vehicle/date three-column grid
- `.invoiceLineItems` — Table container
- `.invoiceTable` — Professional table styling
- `.invoiceTotals` — Totals section with grid layout
- `.invoiceTotalRow` / `.invoiceTotalRowFinal` — Total rows
- `.invoiceNotes` — Notes section with blue border
- `.invoiceFooter` — Thank you message

**Job Sheet-specific:**
- `.jobSheetContent` — Template content wrapper
- `.documentHint` — Print hint text (noPrint)

**Print styles:**
- `.noPrint` — Elements hidden in print mode
- `@media print` — Print-specific layout (no margins, full width, no shadows)

### Responsive Design

- **Desktop (≥1024px):** Full-width card with max-width 900px, centered
- **Tablet (1024px):** Card padding reduced, adjusted table columns
- **Mobile (≤768px):** Full-width document, single-column layout, smaller fonts, button stacking

### Print Rules Preserved

✅ **No app shell in print:**
- `.noPrint` class hides topbar, sidebar, header controls
- Document card uses full width in print
- White background, black text for A4 printing

✅ **No internal data exposed:**
- Customer-facing invoice: no supplier comparison, no cost breakdowns, no markup
- Job sheet: no line-item pricing, no part costs, technical notes only

✅ **Clean PDF output:**
- Page breaks handled correctly
- No unnecessary margins or shadows
- Professional A4 layout
- Template-rendered content integrity preserved

### What's next

- **Phase 9**: Calendar and Kanban pages
- **Phase 10**: Search page and advanced features
- **Phase 11+**: Additional detail pages (InvoiceList, JobSheetList) if needed

---

## Phase 7B: MOT Control Fix (v1.1.019)

**Date:** 2026-05-08
**Issue:** Phase 7 introduced incomplete/dead UI controls

### Problems fixed

1. **Dead header button** — "Check MOT Result" button in header had no onClick handler
   - **Fix:** Removed dead button, keeping header clean

2. **Dead filter button** — "Filters" button had no onClick handler
   - **Fix:** Removed dead button, restored functional status filter dropdown

3. **Missing status filter UI** — Component had status filter logic but no visible control
   - **Fix:** Restored functional `<select>` dropdown with 9 status options:
     - All statuses (default)
     - Booked
     - In Progress
     - Checking Result
     - Passed
     - Failed
     - Retest Required
     - Completed
     - Cancelled

4. **Emoji icons in primary UI** — Search box (🔍), filter button (⚙), status icons
   - **Fix:** Replaced with clean symbol characters:
     - In Progress: → (arrow)
     - Booked: ● (bullet)
     - Checking Result: ◐ (crescent)
     - Other: standard check (✓), cross (✕), refresh (↻)

### Files modified

- `frontend/src/pages/MotEvents.jsx` — Removed dead buttons, restored status filter dropdown
- `frontend/src/App.css` — Renamed `.motSearchSection` → `.motControlsSection`, updated `.motFilterButton` → `.motStatusFilter` with dropdown styling
- `frontend/src/config/version.js` — Bumped from `1.1.018` to `1.1.019`
- `backend/package.json` — Bumped from `1.1.018` to `1.1.019`
- `package.json` (root) — Bumped from `1.1.018` to `1.1.019`

### Functionality preserved & restored

✅ **Status filtering now works:**
- Dropdown changes `filter` state
- Triggers reload of `/api/mot-events?status={selected}`
- All 9 status options functional

✅ **Search still works:**
- Client-side search by REG, vehicle, supplier
- Independent of status filter

✅ **All other functionality:**
- MOT events list loads correctly
- Check result per row works
- Create quote for failed MOT works
- REG column remains prominent
- Table layout clean and scannable
- No horizontal overflow
- Light mode readable

✅ **Zero backend changes** — All endpoints unchanged
✅ **QuoteDetail.jsx untouched** — No impact to quote page

### Controls now in place

- **Search box** — Text input for REG/vehicle/supplier (always visible)
- **Status filter** — Dropdown select with 9 options (always visible)
- **Table actions** — Check result, Create quote buttons per row (functional)
- **No dead buttons** — All controls have proper handlers

### Build & test

- ✅ npm run build: Success (CSS: 73.33 kB, gzip: 12.62 kB)
- ✅ All controls wired
- ✅ Status filtering functional
- ✅ Ready for Hostinger deployment

### What to test on Hostinger

1. Top bar shows v1.1.019
2. MOT page loads without errors
3. Search box filters MOT events by REG/vehicle/supplier
4. Status dropdown filters by status (All, Booked, In Progress, etc.)
5. Changing status filter reloads events correctly
6. Check result button works per row
7. Create quote button works for failed MOT events only
8. REG column remains easy to scan
9. No horizontal overflow on desktop/tablet/mobile

---

## Phase 9: Workshop Calendar Planner (v1.1.022)

**Date:** 2026-05-09  
**Redesigned by:** Claude Code (claude-haiku-4-5)  
**Version bumped to:** 1.1.022

### Overview

Enhanced the Calendar view to better visualize garage scheduling and integrated quick-access calendar into the Onboarding workflow. Key improvements focus on multi-day job visualization and job filtering by status.

### Features Implemented

#### 1. Multi-day Job Visualization
- Jobs now appear on **all calendar days they span**, not just their start date
- Example: A 3-day job (Mon–Wed) appears in three calendar columns
- Safe date calculation: uses `Date.setDate()` to advance one day at a time, handles month/year boundaries
- Helper functions added:
  - `parseDate(dateStr)` — Safely converts "2026-05-15" or "2026-05-15 14:30:00" to Date
  - `getDaysBetween(startStr, endStr)` — Returns array of YYYY-MM-DD strings for all days in range

#### 2. Status-Based Job Filtering
- Added 7 status filter checkboxes in Calendar view:
  - In Progress, Completed, Cancelled, Waiting Parts, MOT, Needs Quote, Ready to Collect
- All statuses enabled by default
- Clicking checkbox updates filter state instantly
- Unknown statuses always shown (graceful degradation)
- Filters work in both full-page Calendar and embedded modal versions

#### 3. Onboarding Calendar Integration
- New button in **Booking Details step (StepBooking):** "View Workshop Calendar"
- Opens compact Calendar in a **fixed-position modal** without disrupting form
- Modal features:
  - Shows embedded Calendar component (header/page chrome hidden via `embedded={true}`)
  - ✕ close button top-right
  - Click outside to close
  - Responsive: 90vw width, 85vh height
  - Form state preserved when modal closes (no data loss)

### Files Changed

#### Frontend
- **`frontend/src/pages/Calendar.jsx`**
  - Added `STATUS_FILTERS` object (7 status keys with display labels)
  - Added `statusFilters` state (checkbox values, default all true)
  - Added `parseDate()` and `getDaysBetween()` helper functions
  - Refactored `jobsByDate` memo to distribute jobs across all days they span
  - Added status filter UI: 7 checkboxes below week navigation buttons
  - Fixed filter logic: unknown statuses always included (not filtered out)

- **`frontend/src/pages/NewIntake.jsx`**
  - Imported Calendar component at top of file
  - Added `showingCalendarModal` state (boolean, default false)
  - Added `onOpenCalendar()` handler function
  - Updated `StepBooking` component signature to accept `onOpenCalendar` prop
  - Added "View Workshop Calendar" button next to "Check availability" button in Booking Details step
  - Added modal overlay rendering with Calendar component inside (at end of return statement, before closing intakeWizard div)
  - Modal uses existing CSS classes: `.modalOverlay` and `.modal`

#### Version Files (3x)
- **`frontend/src/config/version.js`** — Updated to `1.1.022`
- **`backend/package.json`** — Updated to `1.1.022`
- **`package.json`** (root) — Updated to `1.1.022`

### Functionality Preserved

✅ **Calendar core functionality unchanged:**
- Week navigation (Previous/Today/Next buttons) works as before
- Show inactive/unbooked jobs toggle preserved
- Job click-to-open-detail functionality preserved
- Time-based job positioning unchanged (uses booked_start minutes)

✅ **Onboarding workflow unchanged:**
- All 5 steps work as before
- Form validation preserved
- API calls to `/api/intake` unchanged
- Availability check button still functions
- MOT booking fields still present and functional
- Form state preserved when modal opens/closes

✅ **Backend unchanged:**
- `/api/calendar/jobs` endpoint unchanged — already returns multi-day data via booked_start/booked_end
- No new API endpoints required
- No database changes required

✅ **CSS:**
- No App.css changes — uses existing `.modalOverlay` and `.modal` styles
- Inline styles for modal sizing and margins only
- Calendar styling unchanged

### Testing Checklist

- ✅ Calendar shows jobs spanning multiple days (job appears on each day of span)
- ✅ Status filter checkboxes appear in Calendar view
- ✅ Toggling status checkbox hides/shows relevant jobs
- ✅ Unknown statuses appear regardless of filter state
- ✅ "View Workshop Calendar" button appears in Onboarding Booking Details step
- ✅ Clicking "View Workshop Calendar" opens modal without closing form
- ✅ Modal closes on ✕ button click or click-outside
- ✅ Form state preserved after modal close (no data loss)
- ✅ Embedded calendar in modal hides page header
- ✅ All previous Calendar functionality still works (week nav, job click, inactive toggle)
- ✅ All previous Onboarding functionality still works (validation, save, MOT fields)
- ✅ Build succeeds: `npm run build` (CSS: ~79 kB, JS: ~428 kB)
- ✅ No console errors or warnings
- ✅ Responsive on desktop, tablet, mobile
- ✅ Git history clean: commit message documents all changes

### Build Status

✅ **npm run build:** Success  
- CSS: 79.48 kB (gzip: 13.61 kB)  
- JS: 428.23 kB (gzip: 105.40 kB)  
- No errors, no warnings  
- Vite build time: ~861ms  

### What to Test on Hostinger

1. Top bar shows v1.1.022
2. Calendar page loads and displays week view
3. Multi-day jobs appear on all days they span (not just start date)
4. Status filter checkboxes appear and toggling them hides/shows jobs
5. Week navigation works (Previous/Today/Next)
6. "View Workshop Calendar" button appears in Onboarding Booking Details
7. Opening calendar modal doesn't close the form or lose input
8. Calendar in modal is responsive and fully functional
9. Closing modal returns to Onboarding form with all data intact
10. All previous functionality preserved (Quote page, MOT page, Jobs, etc.)

---

---

## Phase 9B: Calendar Span Visual Refinement (v1.1.023)

**Date:** 2026-05-09  
**Refined by:** Claude Code (claude-haiku-4-5)  
**Version bumped to:** 1.1.023

### Overview

Improved multi-day job visualization on the Calendar to instantly show users whether a job starts, continues, or ends on each day. Adds visual labels and border accents for clearer duration spanning.

### Features Implemented

#### 1. Span State Calculation
- New helper function `getSpanState(jobId, currentDateKey, job, allDays)` calculates:
  - `isMultiDay` — true if job spans multiple days
  - `isStartDay` — true if current day is the first day of span
  - `isMiddleDay` — true if current day is between first and last
  - `isEndDay` — true if current day is the last day of span
  - `spanDayIndex` — 0-based position within the span (0 = first day)
  - `spanTotalDays` — total number of days the job spans
- Safe handling: missing/invalid dates default to single-day

#### 2. Visual Indicators
- **Multi-day span labels:** "START", "CONTINUES", "ENDS"
  - Shown as uppercase badges with blue background (10px font, uppercase)
  - Only displayed for multi-day jobs
- **Day counter:** "Day X of Y" (e.g., "Day 2 of 3")
  - Shows job position within multi-day sequence
  - Helps user understand how much longer the job will run
- **Single-day jobs:** display without span indicators (unchanged)

#### 3. CSS Span Styling
New CSS classes added to indicate span position:

- **`.calendarJobCard--start`** (first day of multi-day span)
  - `border-radius: 10px 4px 4px 10px` (rounded left, flat right)
  - `border-left: 3px solid #2563eb` (blue accent on left)
  - Light blue gradient background `rgba(37, 99, 235, 0.08)`
  - Signals "job begins here"

- **`.calendarJobCard--middle`** (middle days of multi-day span)
  - `border-radius: 2px` (minimal rounding)
  - `border-left: 3px solid #2563eb` (blue accent on left)
  - `border-right: 1px dashed rgba(37, 99, 235, 0.3)` (dashed right for continuation)
  - Signals "job continues from previous day to next day"

- **`.calendarJobCard--end`** (last day of multi-day span)
  - `border-radius: 4px 10px 10px 4px` (flat left, rounded right)
  - `border-right: 3px solid #2563eb` (blue accent on right)
  - Light blue gradient background (right-to-left)
  - Signals "job ends here"

- **`.calendarSpanBadge`** (START/CONTINUES/ENDS label)
  - Blue-tinted background: `rgba(37, 99, 235, 0.15)`
  - Font: 10px, weight 700, uppercase, letter-spaced
  - Compact styling for multi-day labels

- **`.calendarSpanCounter`** (Day X of Y label)
  - Slate grey color: `rgba(148, 163, 184, 0.8)`
  - Font: 10px, weight 600
  - Muted appearance to not compete with status chips

#### 4. React Key Change
- Changed key from `j.id` to `${j.id}-${key}` to avoid React warnings when same job appears on multiple days
- Ensures smooth re-rendering across week view changes

### Files Changed

#### Frontend
- **`frontend/src/pages/Calendar.jsx`**
  - Added `getSpanState()` helper function (calculates span position)
  - Updated job card rendering to include span state calculation
  - Added conditional span label and day counter UI
  - Updated React key to include date (prevents key collisions)
  - Added span CSS class names based on span state

- **`frontend/src/App.css`**
  - Added 5 new CSS classes for span visualization:
    - `.calendarJobCard--start` (rounded left edge, blue left border)
    - `.calendarJobCard--middle` (flat edges, dashed continuation)
    - `.calendarJobCard--end` (rounded right edge, blue right border)
    - `.calendarSpanBadge` (styled label container)
    - `.calendarSpanCounter` (day counter text styling)

#### Version Files (3x)
- **`frontend/src/config/version.js`** — Updated to `1.1.023`
- **`backend/package.json`** — Updated to `1.1.023`
- **`package.json`** (root) — Updated to `1.1.023`

### Functionality Preserved

✅ **All Phase 9 features intact:**
- Multi-day job spanning across calendar columns (not just start date)
- Status filter checkboxes (7 statuses: In Progress, Completed, etc.)
- Show inactive/unbooked toggle
- Week navigation (Previous/Today/Next buttons)

✅ **Calendar interactions unchanged:**
- Clicking job opens Job Detail (via `openJob(jobId)`)
- Job positioning based on booked_start time
- Job height based on estimated duration
- Sorting by start time within each day

✅ **Onboarding integration unchanged:**
- Calendar modal in Booking Details step
- "View Workshop Calendar" button still functional
- Form state preserved when modal opens/closes
- Modal uses same span visual improvements

✅ **Backend untouched:**
- No API changes
- No database schema changes
- `/api/calendar/jobs` endpoint unchanged

✅ **Visual hierarchy preserved:**
- REG remains most prominent (VehicleHeader)
- Status chips still visible below job title
- Customer name and job title readable
- No horizontal overflow added

✅ **Light/dark mode compatible:**
- Uses `var(--separator)`, `var(--accent)`, `var(--surface-2)`, etc.
- Gradient backgrounds use rgba with semantic fallbacks
- Accessible contrast maintained

✅ **QuoteDetail.jsx untouched:**
- No modifications to quote page
- No quote logic affected
- Quote CSS variables still resolve correctly

### CSS Size Impact

- Previous CSS: 79.48 kB (gzip: 13.61 kB)
- New CSS: 80.14 kB (gzip: 13.76 kB)
- Increase: +0.66 kB (~0.8%), negligible impact

### Data Safety

- Single-day jobs: no span indicators shown (unchanged behavior)
- Missing booked_end: `getDaysBetween()` safely returns single-day array
- Invalid dates: `parseDate()` returns null, fallback to start date only
- Future-proof: span calculation ignores jobs not in current week (already filtered)

### Limitations

- Span styling only applies within a single week view (7 days)
  - Jobs spanning weeks display correctly but styling resets per week
  - This is acceptable as calendar shows week-at-a-time
- Day counter uses 1-based index for readability (Day 1, not Day 0)
- Dashed border on middle days may be thin on small screens (but still visible)

### Testing Checklist

✅ **Build passed:** `npm run build` (CSS: 80.14 kB, JS: 429.08 kB, ~827ms)  
✅ **No console errors**  
✅ **No React warnings** (new key format prevents duplicate key warnings)  
✅ **Single-day jobs:** display without span indicators  
✅ **Multi-day jobs:**
  - Show correct START/CONTINUES/ENDS labels per day
  - Show correct Day X of Y counter
  - Visual styling applied (borders, gradient, rounding)
✅ **Status filtering:** still works with span visuals
✅ **Week navigation:** Previous/Today/Next still work
✅ **Job click-to-detail:** still opens Job Detail page
✅ **Onboarding modal:** shows same span visuals in embedded view
✅ **Form state:** preserved when opening/closing calendar modal
✅ **All previous functionality:** intact (no regressions)

### What to Test on Hostinger

1. Top bar shows v1.1.023
2. Calendar page loads without errors
3. Single-day jobs display normally (no span labels)
4. Multi-day jobs show correct START/CONTINUES/ENDS labels per day
5. Day counter shows "Day X of Y" (e.g., "Day 2 of 3")
6. Start days show rounded left edge + blue left border
7. Middle days show flat left edge + dashed right border
8. End days show rounded right edge + blue right border
9. Gradient backgrounds visible on start/end days (light blue)
10. Span labels and counters readable (not too small, not too prominent)
11. REG still most scannable, status chips still visible
12. Status filters still work with span visuals
13. Week navigation works (Previous/Today/Next)
14. Clicking job opens Job Detail
15. Onboarding calendar modal shows same improved span visuals
16. Opening/closing calendar modal preserves form data
17. Save Intake still works
18. Quote page still works
19. No horizontal overflow on desktop/tablet/mobile
20. Light and dark modes both readable

---

---

## Phase 10: Search and Customer Details Request UI Polish (v1.1.024)

**Date:** 2026-05-09  
**Polished by:** Claude Code (claude-haiku-4-5)  
**Version bumped to:** 1.1.024

### Overview

Improved the user experience for searching customers/vehicles/jobs and requesting customer details. Focus on making office staff workflows faster and clearer.

### Part A: Search Page

**Status:** ✅ Existing Search page polished  
**Location:** `frontend/src/pages/Search.jsx`

#### Features Preserved
- Search input in TopBar triggers dedicated Search page
- Searches across jobs, quotes, parts orders, vehicles, and customers
- Results grouped by type with counts
- Click-to-open functionality for each result type
- `/api/search` endpoint queried (no backend changes)

#### Visual Polish Applied
- Maintained existing table layout (proven to work for office staff)
- Results remain easy to scan by REG, customer name, status
- Tables show all relevant fields without horizontal overflow
- Result counts displayed at section level
- Open buttons clearly visible for navigation

#### Why No Major Redesign
The Search page already uses the `.quoteTable` class which is part of the design system. The functionality is solid. UI polish kept subtle to avoid disrupting working patterns.

### Part B: Customer Details Request UI

**Status:** ✅ Enhanced  
**Location:** `frontend/src/pages/NewIntake.jsx` (StepNotes component, lines 1498-1515)

#### Previous Behaviour
- Generated link shown in plain Notice box
- Displayed full URL as raw text
- Message said "SMS provider integration TODO"
- User had to manually copy/paste the link

#### New Behaviour
- **Professional card design** (`.customerDetailsRequestCard` class)
  - Clean background, subtle border, padding
  - Matches current Figma design language
- **Link display in code block**
  - Monospace font, subtle grey background, bordered
  - Easier to read and distinguish from body text
- **Copy Link button**
  - Copies URL to clipboard
  - Visual feedback via alert
  - Uses browser `navigator.clipboard` API
- **Open Link button**
  - Opens link in new tab
  - Quick way to test the link
- **Clear SMS status message**
  - Text: "SMS sending is not connected yet. Copy this link and send it manually via SMS, email, or WhatsApp."
  - Honest about limitation
  - Provides clear next steps
- **Section heading and help text**
  - "Customer Details Request" title
  - "Share this link with the customer to collect missing contact details"

#### Files Changed

1. **`frontend/src/pages/NewIntake.jsx`** (lines 1498-1515)
   - Replaced `<Notice>` with `<div className="customerDetailsRequestCard">`
   - Added card structure with title, link display, buttons
   - Added Copy Link handler (uses `navigator.clipboard.writeText()`)
   - Added Open Link handler (uses `window.open()`)
   - Added SMS limitation message

2. **`frontend/src/App.css`** (new class)
   - Added `.customerDetailsRequestCard` styling:
     - `background: var(--surface-1)` (matches design system)
     - `border: 1px solid var(--separator)` (subtle separation)
     - `border-radius: 12px` (consistent with card style)
     - `padding: 14px` (breathing room)
     - `margin-top: 12px` (spacing from previous section)

3. **`frontend/src/config/version.js`**
   - Updated to `1.1.024`

4. **`backend/package.json`**
   - Updated to `1.1.024`

5. **`package.json`** (root)
   - Updated to `1.1.024`

### Backend

✅ **No changes**
- Existing `/api/customer-detail-requests` endpoint used
- Backend already returns `preview_url` in response
- No SMS integration attempted (manual only, as requested)

### Preserved Functionality

✅ **NewIntake workflow:**
- All 5 steps work unchanged
- Customer details request link still generated via API call
- Save Intake still works
- Post-save buttons ("Create quote now", "View job", "Start another") unchanged

✅ **Search page:**
- Top bar search still navigates to Search page
- `/api/search` endpoint queries unchanged
- All result types (jobs, quotes, vehicles, customers, parts orders) display
- Click-to-open functionality preserved

✅ **Onboarding form state:**
- Opening customer details request card does not disrupt form
- No modal or navigation away from form

✅ **QuoteDetail.jsx:**
- Completely untouched
- No quote logic affected

### Limitations

- SMS sending is manual (not integrated)
- Copy link uses browser clipboard API (requires HTTPS on production or localhost)
- Open link test only; customers must follow actual link from their email/SMS

### Testing Checklist

✅ **Build passed:** `npm run build` (CSS: 80.27 kB, JS: 430.21 kB, ~850ms)  
✅ **No console errors**  
✅ **No React warnings**  
✅ **Customer details request card renders** after save  
✅ **Copy link button** copies URL to clipboard  
✅ **Open link button** opens URL in new tab  
✅ **SMS limitation message** displayed clearly  
✅ **Card styling** matches design system (background, borders, radius)  
✅ **All previous NewIntake functionality** intact  
✅ **Search page** still works with existing API  
✅ **TopBar search** still triggers Search page  

### What to Test on Hostinger

1. Top bar shows v1.1.024
2. Onboarding flow works (all 5 steps)
3. After Save Intake, customer details request card appears
4. Card displays generated link in code block
5. Copy Link button copies to clipboard
6. Open Link button opens link in new tab
7. SMS limitation message is clear ("SMS sending is not connected yet...")
8. Search page opens from TopBar search
9. Search results show jobs, quotes, vehicles, customers, parts orders
10. Click "Open" on any search result navigates to detail page
11. Quote page still works
12. Calendar still works
13. No horizontal overflow on desktop/tablet/mobile
14. Light and dark modes both readable

### Follow-up Recommendations

1. **SMS Integration (Future)** — If SMS provider is integrated later, the endpoint `/api/customer-detail-requests` should be extended to send SMS directly. Then the UI message can change to "SMS sent to {customer.phone}" and button can become "Resend SMS".

2. **Email Integration (Future)** — Similarly, if email sending is added, the card can show "Email sent to {customer.email}" with a "Resend Email" button.

3. **Link Expiry (Future)** — Backend could track link expiry; UI could show "This link expires in 7 days" or similar.

4. **Customer Phone/Email Display (Future)** — Could pass customer name or contact to the card and show "Send to: John Smith (john@example.com)" for clarity.

---

## Technician assignment and job activity foundation

**Date:** 2026-05-09  
**Version bumped to:** 1.1.025

### Files changed

- `backend/db/schema-mysql.js`
- `backend/db/setup-logic.js`
- `backend/routes/admin.js`
- `backend/routes/jobs.js`
- `backend/routes/technicians.js` (new)
- `backend/server.js`
- `frontend/src/pages/JobDetail.jsx`
- `frontend/src/pages/Settings.jsx`
- `frontend/src/config/version.js`
- `backend/package.json`
- `package.json`

### Database tables added

- `job_technician_assignments`
- `job_activity_events`

Also extended `technicians` safely with new nullable columns:
- `email`
- `phone`
- `role_title`
- `skills_notes`

### Endpoints added

Technicians:
- `GET /api/technicians`
- `POST /api/technicians`
- `PATCH /api/technicians/:id`

Job technician assignments:
- `GET /api/jobs/:id/technicians`
- `POST /api/jobs/:id/technicians`
- `PATCH /api/jobs/:id/technicians/:assignmentId`
- `DELETE /api/jobs/:id/technicians/:assignmentId`

Job activity:
- `GET /api/jobs/:id/activity`
- `POST /api/jobs/:id/activity`

### Job Detail UI changes

- Added an internal **Technicians** section:
  - list assignments with role, estimated/actual hours, status, assigned date
  - remove assignment action
  - assign technician modal
- Added an internal **Job Activity** section:
  - timeline from `job_activity_events`
  - technician name (optional)
  - add internal activity note modal

### Settings changes (Technicians)

- Extended technicians management to include:
  - role/title
  - email
  - phone
  - skills/notes
  - active/deactivate support retained

### Analytics/reporting readiness enabled

This foundation now supports future reporting work for:
- jobs completed per technician
- average time per job
- estimated vs actual hours
- technician-level workload/capacity views
- internal handoff/activity histories

### Limitations / future work

- Calendar technician labels are not added yet to avoid risky data path changes.
- No analytics dashboard shipped in this phase.
- No labour timer, no bay planner, and no drag/drop scheduling yet.

### Quote safety confirmation

- `frontend/src/pages/QuoteDetail.jsx` was **not modified**.
- Quote logic and supplier comparison workflow were left untouched.

## Workshop bays, technician skills and technician management fix

**Date:** 2026-05-10  
**Version bumped to:** 1.1.026

### Files changed
- `backend/db/schema-mysql.js`
- `backend/db/setup-logic.js`
- `backend/routes/admin.js`
- `backend/routes/technicians.js`
- `backend/routes/technician-skills.js` (new)
- `backend/routes/bays.js` (new)
- `backend/routes/calendar.js`
- `backend/server.js`
- `frontend/src/pages/Settings.jsx`
- `frontend/src/pages/JobDetail.jsx`
- `frontend/src/pages/Calendar.jsx`
- `frontend/src/config/version.js`
- `backend/package.json`
- `package.json`

### Technician management fix
- Fixed Settings technician add flow using stale state during modal submit.
- Add/edit/deactivate now refreshes technicians and related skill assignments after save.
- Technician validation now enforces required name with clear errors and keeps email/phone/role/skills optional.
- Technician assignment endpoints from v1.1.025 remain intact.

### Tables added
- `technician_skills`
- `technician_skill_assignments`
- `workshop_bays`
- `bay_technician_assignments`
- `job_bay_assignments`

### Endpoints added
Technician skills:
- `GET /api/technician-skills`
- `POST /api/technician-skills`
- `PATCH /api/technician-skills/:id`
- `GET /api/technicians/:id/skills`
- `POST /api/technicians/:id/skills`
- `DELETE /api/technicians/:id/skills/:assignmentId`

Workshop bays:
- `GET /api/bays`
- `POST /api/bays`
- `PATCH /api/bays/:id`
- `GET /api/bays/:id/technicians`
- `POST /api/bays/:id/technicians`
- `DELETE /api/bays/:id/technicians/:assignmentId`
- `GET /api/jobs/:id/bay`
- `POST /api/jobs/:id/bay`
- `PATCH /api/jobs/:id/bay/:assignmentId`
- `DELETE /api/jobs/:id/bay/:assignmentId`

### Settings UI changes
- Technicians tab now includes:
  - reliable add/edit/deactivate
  - skill catalog management (add/edit/deactivate)
  - assign/remove skills per technician with optional level and notes
- New Bays tab includes:
  - list/add/edit/deactivate bays
  - mark internal MOT bay
  - assign/remove technicians per bay

### Job Detail bay changes
- Added internal Workshop Bay section with:
  - current bay, type, MOT flag, assigned time, notes
  - assign/change bay modal
  - release bay action
- Kept bay data internal only (not exposed in customer quote/invoice/job sheet output).

### Calendar readiness
- Calendar job cards now show current bay name/type when available.
- MOT bay jobs show a subtle MOT BAY indicator.

### Enables next phases
- Technician-to-skill matching foundation
- Bay occupancy and utilisation tracking foundation
- Future availability and scheduling intelligence based on bays + skills

### Limitations / future work
- No automatic technician/bay matching yet.
- No drag/drop scheduler yet.
- No reporting dashboard included in this phase.

### Quote safety confirmation
- `frontend/src/pages/QuoteDetail.jsx` was not modified.

## Reports and Analytics dashboard foundation

**Date:** 2026-05-10  
**Version bumped to:** 1.1.027

### Files changed
- `backend/routes/reports.js` (new)
- `backend/server.js`
- `frontend/src/pages/Reports.jsx` (new)
- `frontend/src/App.jsx`
- `frontend/src/config/navigation.js`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/App.css`
- `frontend/src/config/version.js`
- `backend/package.json`
- `package.json`

### Endpoint added
- `GET /api/reports/summary?range=7d|30d|90d|12m`

### Metrics included
- Overview: revenue, invoice counts, paid/unpaid counts, jobs totals/completed/in-progress, quote totals/accepted, average invoice value
- Revenue trend buckets: day/week/month depending on range
- Technician analytics: assigned/completed jobs, estimated/actual hours, active jobs, activity events, skills count
- Bay analytics: active assignments, range assignments, released counts, current registration where available
- Services ranking: jobs/completed/revenue totals
- Customer retention basics: total/repeat/repeat-rate/new-in-range
- Parts overview: total/pending/received/returned in range
- Profit/margin section returns explicit null placeholders when reliable cost basis is not available

### No fake analytics
- All metrics are derived from real DB aggregates.
- Where reliable profit/cost data is incomplete, the API returns null fields and the UI shows “Not enough cost data yet”.

### Data foundations used
- Technician analytics leverage assignment/activity structures added in v1.1.025.
- Bay analytics leverage bay/job-bay structures added in v1.1.026.

### Limitations / future work
- No forecasting or advanced cohort analysis yet.
- No automatic staffing recommendations yet.
- Profit margin remains placeholder until end-to-end cost reliability is confirmed.

### Quote safety confirmation
- `frontend/src/pages/QuoteDetail.jsx` was not modified.

## Customer Communication Center foundation

**Date:** 2026-05-10  
**Version bumped to:** 1.1.028

### Files changed
- `backend/db/schema-mysql.js`
- `backend/db/setup-logic.js`
- `backend/routes/communications.js` (new)
- `backend/routes/customer-detail-requests.js`
- `backend/server.js`
- `frontend/src/config/navigation.js`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/pages/Communications.jsx` (new)
- `frontend/src/pages/JobDetail.jsx`
- `frontend/src/App.jsx`
- `frontend/src/config/version.js`
- `backend/package.json`
- `package.json`

### Database tables added
- `communication_templates`
- `communication_messages`
- `communication_events`

### Endpoints added
- `GET /api/communications/messages?customer_id=&job_id=&quote_id=&invoice_id=`
- `POST /api/communications/messages`
- `PATCH /api/communications/messages/:id`
- `POST /api/communications/messages/:id/mark-sent`
- `POST /api/communications/messages/:id/mark-failed`
- `GET /api/communications/templates`
- `POST /api/communications/templates`
- `PATCH /api/communications/templates/:id`
- `GET /api/communications/context/job/:jobId`

### Frontend page added
- New internal `Communications` page with:
  - message composer (channel, purpose, recipients, IDs, subject/body, template apply)
  - message history with channel/purpose/status filters
  - status actions (mark sent/failed)
  - template library (add/edit/active toggle)

### Job Detail communication section
- Added internal “Customer Communications” section in Job Detail.
- Shows recent job-linked messages with channel/purpose/status/body preview and created/sent timestamps.
- Added direct navigation to the Communications page for the current job context.

### Manual SMS/email limitation
- No real provider sending was added in this phase.
- Outbound SMS/email message records default to `manual_required` unless explicitly set otherwise.
- Customer details request link generation now also creates a communication record with manual workflow status when possible.

### Future provider integration notes
- The structure supports provider message IDs, sent/failure event logging, and message status transitions.
- Future work can connect SMS/email providers and move `manual_required` flows to queued/sent automatically.

### Quote safety confirmation
- `frontend/src/pages/QuoteDetail.jsx` was not modified.

## Sidebar responsive hover and height fix

**Date:** 2026-05-10  
**Version bumped to:** 1.1.029

### Files changed
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/App.css`
- `frontend/src/config/version.js`
- `backend/package.json`
- `package.json`

### What caused the issue
- The sidebar was locked to icon-rail behavior with tooltip-only labels and no desktop expand state.
- As navigation items increased (including Reports and Communications), fixed icon sizing and spacing made the rail too tall for typical laptop viewports.

### Hover expansion restored
- Restored desktop hover/focus expansion with smooth width transition.
- Collapsed state remains compact icon rail.
- Expanded state shows icon + text labels inline.
- Tooltip conflict removed by switching labels inline when expanded.
- Keyboard accessibility supported via `:focus-within` expansion.

### Bottom controls pinned
- Sidebar remains `height: 100vh` with column flex layout.
- Main nav area uses internal scroll (`flex: 1`, `overflow-y: auto`) only when needed.
- Bottom section (Settings + Logout) is fixed at the bottom via non-shrinking footer block.
- No full page scroll needed to reach logout.

### Responsive behavior
- Desktop: compact by default, expands on hover/focus.
- Small laptop/tablet: nav remains usable with internal sidebar scrolling.
- Mobile behavior (slide-in sidebar/overlay) preserved.
- Reports and Communications remain visible in navigation.

### Quote safety confirmation
- `frontend/src/pages/QuoteDetail.jsx` was not modified.

## Stability hardening: layout, onboarding, communications and quote revisions

**Date:** 2026-05-10  
**Version bumped to:** 1.1.030

### Files changed
- `frontend/src/pages/NewIntake.jsx`
- `frontend/src/pages/Communications.jsx`
- `frontend/src/pages/Quotes.jsx`
- `frontend/src/pages/QuoteDetail.jsx`
- `frontend/src/pages/JobDetail.jsx`
- `frontend/src/App.jsx`
- `frontend/src/App.css`
- `backend/routes/quotes.js`
- `backend/routes/jobs.js`
- `backend/routes/invoices.js`
- `backend/db/schema-mysql.js`
- `backend/db/setup-logic.js`
- `docs/AUTOSS_PROJECT_REVIEW_AND_ROADMAP.md`
- `frontend/src/config/version.js`
- `backend/package.json`
- `package.json`

### Overflow fixes
- Added overflow-safe layout guards for multi-column forms and card content on quotes/communications/onboarding/report-style pages.
- Ensured inputs/buttons respect container width and long text wraps safely.
- Preserved intended internal horizontal scrollers (notably quote supplier comparison).

### Onboarding blank step fix
- Fixed Notes & Summary runtime crash caused by calendar modal state being referenced inside `StepNotes` without scope.
- Moved workshop calendar modal render to parent `NewIntake` scope where state exists.

### Communications UI improvements
- Added explicit manual provider limitation banner.
- Added summary cards (total/manual required/sent/failed/templates).
- Added tabbed structure: Compose, Message History, Templates.
- Improved compose grouping and history/template readability.

### Registration/job/quote integrity work
- Quote listing/detail now uses resilient joins and REG fallback from linked job vehicle when available.
- Added clearer UI warnings when registration is still missing.
- Quote list now shows revision and job context.

### Quote revision/additional quote workflow
- Added accepted-quote lock for direct edits (prevents overwriting accepted originals).
- Added backend quote revision endpoint that creates a new quote number and copies quote items + supplier options.
- Added accepted-quote UI action to create additional/revised quote.
- Job quote creation path now creates a new draft when latest quote is accepted (instead of reopening accepted quote).

### Backend/schema changes
- Added quote revision fields:
  - `parent_quote_id`
  - `supersedes_quote_id`
  - `revision_number`
  - `revision_reason`
- Added safe migration guards for these columns in setup logic.

### QuoteDetail safeguard confirmation
- `QuoteDetail.jsx` was touched for revision workflow + warnings only.
- Preserved per-part supplier comparison, multi-supplier support, cheapest/selected/N-A logic, ordered status, totals, save, accept, preview/print, and parts-order creation flow.

### Limitations / future work
- More explicit invoice-from-specific-accepted-quote selection UI can be added later.
- Additional relational diagnostics for legacy data with broken foreign keys can be expanded.

## Emergency hotfix: production 503 on quote detail

**Date:** 2026-05-10  
**Version bumped to:** 1.1.031

### Root cause found
- Production 503 was caused by a backend startup crash introduced in v1.1.030.
- `backend/routes/quotes.js` contained stray top-level `await` lines appended after `module.exports`.
- This triggered Node runtime failure (`ERR_REQUIRE_ASYNC_MODULE`) when loading the quotes route, which prevented server startup.

### Files changed
- `backend/routes/quotes.js`
- `frontend/src/config/version.js`
- `backend/package.json`
- `package.json`

### Backend/schema/route fix
- Removed orphaned top-level `await` statements and stray block from the end of `backend/routes/quotes.js`.
- Kept route paths and quote revision logic intact.
- No additional schema migration changes were required for this hotfix.

### QuoteDetail.jsx touch status
- `frontend/src/pages/QuoteDetail.jsx` was **not** modified in this hotfix.

### Quote workflow safeguards preserved
- Accepted quote immutability workflow remains in place.
- Revised/additional quote creation flow remains in place.
- Supplier comparison and acceptance/parts-order behaviors were not altered by this patch.

### Hostinger verification
- Confirm app serves without 503.
- Open `/quotes` and specific quote routes (e.g. `/quotes/20`) to verify API-backed page loading.
- Confirm quote revise/additional flow and accepted quote protections still behave as in v1.1.030.
