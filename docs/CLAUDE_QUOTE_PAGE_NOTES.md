# Quote Page — Claude Code Refactor Notes

**Date:** 2025-05-03
**Refactored by:** Claude Code (claude-sonnet-4-6)

---

## Warning

> **Do not rewrite QuoteDetail.jsx from scratch without reviewing this note.**
>
> The quote page has been carefully structured for workshop office use. Blindly regenerating it will break the per-part supplier comparison logic, the sticky totals layout, and the print fix described below.

---

## Files Changed

- `frontend/src/pages/QuoteDetail.jsx` — full JSX restructure, logic preserved
- `frontend/src/App.css` — new classes added for part cards, supplier pricing row, totals colouring

---

## Summary

Claude Code reviewed and refactored the quote page UI and calculation flow for practical workshop use. All existing functionality was preserved — no features were removed.

Changes made:

1. **Section order corrected**: Fixed charges → Labour → Consumables → Parts Comparison (parts were previously shown before simpler sections, which was confusing)
2. **Sticky totals moved**: The totals bar now renders at the top of the content area (just below the header), using `position: sticky; top: 64px`, so it remains visible whilst editing any section below.
3. **Parts comparison redesigned**: Each part is a clean card with a compact top row (include checkbox, name, part number, quantity, duplicate, remove). Supplier options are in a horizontal scroll area scoped to that part only — no full-page horizontal scroll.
4. **Supplier pricing layout fixed**: Cost ex VAT, Markup %, and Sell ex VAT are now on a dedicated inline pricing row (`.supplierPriceRow`). Inc VAT is displayed as a full-width gold-bordered badge below.
5. **Print bug fixed**: `printCustomerQuoteDocument` previously read stale React state after an `await`. Fixed by using the HTML returned directly from `loadCustomerQuotePreview()` rather than the state variable.
6. **Supplier input stale data fixed**: Supplier card inputs used `defaultValue` which did not update after API reloads. Fixed by keying each supplier cell with `${option.id}_${reloadCount}` so React remounts the inputs after every data reload.
7. **Margin colouring**: Totals bar shows margin green if positive, red if negative.
8. **Duplicate part button**: Added to each part card (was already wired to `duplicateItem()` but had no UI trigger).

---

## Intended Quote Page Structure

```
1. Quote header
   — REG plate / make+model / customer / quote number / status
   — Save quote (yellow), Customer accepts (green), status select
   — Back, Parts orders, Preview, Print buttons

2. Sticky totals bar (visible whilst scrolling)
   — Labour / Fixed / Consumables / Parts sub-totals
   — Cost ex VAT, Sell ex VAT, VAT, Sell inc VAT, Margin

3. Quote context
   — Title, internal notes, customer notes

4. Fixed / Predefined charges
   — Simple table: use | item | qty | sell ex VAT | inc VAT | remove

5. Labour
   — Simple table: use | description | hours | rate | sell | inc VAT | total | actions

6. Consumables
   — Simple table: use | item | qty | sell ex VAT | inc VAT | remove

7. Parts Comparison   ← only complex section
   — Per-part cards
   — Each part: include checkbox, name, part number, qty, duplicate, remove
   — Per-part supplier horizontal scroll (does NOT scroll the full page)
   — Each supplier card: Cost / Markup / Sell (inline) → Inc VAT badge → Brand / Part No → ETA → Select / N/A / Ordered

8. Parts orders (read-only, populated after Customer accepts)

9. Activity log
```

---

## Follow-up Layout Fix — 2025-05-03

**Issue:** Supplier cards were still overflowing and overlapping after the initial refactor.

**Files changed:**
- `frontend/src/pages/QuoteDetail.jsx` — supplier card JSX reordered; `supplierPriceRow` → `supplierPriceGrid`; ETA row gets its own class; Selected/N/A status chips added to card header
- `frontend/src/App.css` — `.partSupplierScroller` changed from CSS grid auto-flow to flexbox; `.supplierCell` given fixed `flex: 0 0 300px` dimensions; `.supplierNumbers` fixed min-width; new `.supplierPriceGrid`, `.supplierEtaRow` classes; `miniTag.selected` / `miniTag.na` chips

**Root causes fixed:**
1. `.partSupplierScroller` used `display: grid; grid-auto-flow: column` — this caused the grid container's intrinsic width to exceed the viewport. Changed to `display: flex; flex-wrap: nowrap`.
2. `.supplierCell` had no explicit flex dimensions, so cards could grow unconstrained. Changed to `flex: 0 0 300px; overflow: hidden`.
3. `.supplierNumbers { flex-wrap: nowrap }` combined with the `datetime-local` input (which has a large browser-native minimum width ~190px) caused the ETA row to overflow the card. ETA row now uses its own `.supplierEtaRow` class with `flex-wrap: wrap`.
4. `.supplierNumbers .compactInput { min-width: 70px }` conflicted with narrow cards. Changed to `min-width: 0`.
5. Supplier pricing row changed from flex to CSS grid (`repeat(3, minmax(0, 1fr))`) so three inputs share the card width equally without spilling.

**Important — functionality must remain per-part:**
Suppliers are added to individual parts via `addSupplierToPart(itemId)`. Do NOT change this to global supplier columns. The `partSupplierDrafts[item.id]` state is keyed per part item ID.

**Supplier card row order (after follow-up fix):**
1. Supplier name + Selected / Best / Ordered / N/A chips (display)
2. Brand input + Part No input
3. ETA datetime + On shelf checkbox
4. Cost ex VAT + Markup % + Sell ex VAT (3-column grid)
5. Inc VAT badge (gold, full width)
6. Select radio + N/A checkbox + Ordered checkbox (controls)

---

## Key Behaviours to Preserve

- Adding a supplier to a part adds it **only to that part** — not to all parts.
- N/A suppliers are muted and do not count in totals.
- If no supplier is manually selected, the cheapest valid supplier is used in totals.
- If a supplier IS selected, that supplier is used even if not cheapest.
- `reloadCount` increments on every `load()` call — this forces React to remount supplier card inputs with fresh `defaultValue` data.
- `loadCustomerQuotePreview()` returns the HTML string directly — do not remove the return value.

---

## v1.1.045 UX Pass — 2026-05-18

**Goal:** make the quote page feel like a workshop quoting workspace, not a demo. No calculation logic changed.

### Section order (top to bottom)
1. Vehicle / customer / quote header (`pageHeader`).
2. Quote Content (`cardBox quoteMetaPanel`) — **collapsible, default open**. Holds title, customer details, internal notes, customer notes, save details button, optional customer-details-request button.
3. Customer Quote Preview (only when `showCustomerQuote` toggled).
4. Labour (`cardBox` + `labourTable`).
5. Fixed Costs (`cardBox` + `quoteSimpleTable`) — **now includes consumables**. Rows render `[...fixedItems, ...consumableItems]`; each row carries a `miniTag` (CONSUMABLE in warn-tone for `oil`/`service_item`, otherwise the item_type uppercased). The predefined dropdown lists fixed presets plus consumable presets (suffixed `(consumable)`). Buttons: `Add charge` (item_type `diagnostic`), `Add consumable` (item_type `oil`).
6. Parts Comparison (unchanged).
7. Parts Orders (read-only inline summary, unchanged).
8. Activity (unchanged).
9. Sticky bottom totals bar.

### Sticky bottom totals
- Rendered last in the page, inside `<div className="quoteStickyTotals">`. Uses `position: sticky; bottom: 0;` relative to `.main`'s scroll container.
- A `<div className="quoteStickyTotalsSpacer">` above it adds page bottom padding so content is never hidden.
- Shows 4 totals: Cost Price · Total EX VAT · Total INC VAT (emphasised green) · Margin (green if ≥ 0, red if negative).
- Stacks 2-up on screens ≤ 700px; spacer grows so nothing is covered.
- Negative margins through to inc-VAT highlight rules come from `App.css` `.stickyTotalEmphasis`, `.stickyTotalPos`, `.stickyTotalNeg`, with light-theme overrides.

### Consumables — backend compatibility
- Backend `ITEM_TYPES` (in `backend/routes/quotes.js`) is unchanged: `oil` and `service_item` still exist and `CONSUMABLE_TYPES` in `QuoteDetail.jsx` still recognises them.
- The frontend simply renders consumables inside the Fixed Costs section. Totals memo still tracks `consumablesEx` separately even though it is no longer surfaced as its own card (kept for future reports).

### Parts orders drawer
- Header button "Parts orders (N)" opens an in-page drawer (`modal modalWide partsOrdersDrawer`). No navigation away from the quote.
- Drawer states:
  - Empty — `No parts orders for this quote yet.` plus an "Open full Parts page" fallback.
  - Filled — table of orders with quick status select (pending=needed, ordered, received, return_required, returned, cancelled). Each change calls `PATCH /api/parts-orders/:id/status` and reloads quote data with scroll preservation.
  - Error — `partsOrderError` notice surfaces failed status updates.
  - Busy — the row's status `<select>` disables while saving.
- Backend "Fitted" status does not exist; the drawer intentionally does **not** invent it. Fitted/usage tracking belongs to the future full Parts page work.
- The `onViewPartsOrders` prop is still wired and used inside the drawer as "Open full Parts page".
