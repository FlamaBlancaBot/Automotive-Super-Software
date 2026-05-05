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
5. The sidebar expand/collapse is purely CSS (`:hover` on `.sidebar.isCollapsed`)
6. The KPI card grid is responsive via CSS media queries (12→6→4→3 col spans)
7. Do not add Tailwind or a component library — this app uses custom CSS classes only
