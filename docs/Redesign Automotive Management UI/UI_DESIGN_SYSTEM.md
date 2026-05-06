# Automotive Management Platform - UI Design System

## 📐 Overview

This document provides complete UI patterns, components, and design tokens for the Automotive Management Platform. Use this guide to recreate the exact dark mode interface.

---

## 🎨 Color Palette

### Background Colors
```css
--bg-primary: #0a0e1a     /* Main background */
--bg-secondary: #0f1420   /* Cards, panels */
--bg-tertiary: #1a1f2e    /* Hover states */
```

### Border Colors
```css
--border-primary: #374151    /* gray-800 equivalent */
--border-secondary: #4b5563  /* gray-700 equivalent */
```

### Text Colors
```css
--text-primary: #f3f4f6      /* gray-100 - Main text */
--text-secondary: #9ca3af    /* gray-400 - Secondary text */
--text-tertiary: #6b7280     /* gray-500 - Muted text */
```

### Accent Colors
```css
--blue-primary: #2563eb      /* Blue-600 */
--blue-secondary: #1d4ed8    /* Blue-700 */
--purple-primary: #9333ea    /* Purple-600 */
--green-primary: #16a34a     /* Green-600 */
--orange-primary: #ea580c    /* Orange-600 */
--red-primary: #dc2626       /* Red-600 */
--yellow-primary: #eab308    /* Yellow-500 */
```

### Gradients
```css
--gradient-blue-purple: linear-gradient(to bottom right, #2563eb, #9333ea)
--gradient-blue: linear-gradient(to bottom, #2563eb, #1d4ed8)
--gradient-green: linear-gradient(to bottom, #16a34a, #059669)
```

---

## 📏 Spacing Scale

```css
--spacing-1: 0.25rem  /* 4px */
--spacing-2: 0.5rem   /* 8px */
--spacing-3: 0.75rem  /* 12px */
--spacing-4: 1rem     /* 16px */
--spacing-5: 1.25rem  /* 20px */
--spacing-6: 1.5rem   /* 24px */
--spacing-8: 2rem     /* 32px */
--spacing-10: 2.5rem  /* 40px */
--spacing-12: 3rem    /* 48px */
```

---

## 🔤 Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 
             'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 
             sans-serif;
```

### Font Sizes
- **Heading 1**: `text-2xl` (1.5rem / 24px) - Page titles
- **Heading 2**: `text-xl` (1.25rem / 20px) - Section headers
- **Heading 3**: `text-lg` (1.125rem / 18px) - Card titles
- **Body**: `text-base` (1rem / 16px) - Regular text
- **Small**: `text-sm` (0.875rem / 14px) - Labels, secondary info
- **Tiny**: `text-xs` (0.75rem / 12px) - Status badges, hints

---

## 🎯 Core UI Patterns

### 1. Card Component

**Standard Card**
```tsx
<div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
  <h3 className="text-lg font-semibold mb-4">Card Title</h3>
  {/* Card content */}
</div>
```

**Clickable Card (Hover Effect)**
```tsx
<button className="bg-[#0f1420] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all text-left w-full">
  {/* Card content */}
</button>
```

### 2. Status Badges

**Success Badge**
```tsx
<span className="px-3 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-300 border border-green-700/30">
  Completed
</span>
```

**Warning Badge**
```tsx
<span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-300 border border-yellow-700/30">
  Pending
</span>
```

**Info Badge (Blue)**
```tsx
<span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-700/30">
  In Progress
</span>
```

**Error Badge**
```tsx
<span className="px-3 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-300 border border-red-700/30">
  Failed
</span>
```

**Neutral Badge**
```tsx
<span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700/30 text-gray-300 border border-gray-600/30">
  Inactive
</span>
```

### 3. Buttons

**Primary Button**
```tsx
<button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-medium transition-all">
  Primary Action
</button>
```

**Secondary Button**
```tsx
<button className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all">
  Secondary Action
</button>
```

**Icon Button**
```tsx
<button className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center">
  <Icon className="w-5 h-5" />
</button>
```

**Solid Color Buttons**
```tsx
/* Blue */
<button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all">
  Blue Action
</button>

/* Green */
<button className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-all">
  Confirm
</button>

/* Red */
<button className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-all">
  Delete
</button>
```

### 4. Form Inputs

**Text Input**
```tsx
<div>
  <label className="block text-sm font-medium mb-2">Label</label>
  <input
    type="text"
    placeholder="Enter text..."
    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
  />
</div>
```

**Search Input**
```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
  <input
    type="text"
    placeholder="Search..."
    className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
  />
</div>
```

**Select Dropdown**
```tsx
<select className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

**Textarea**
```tsx
<textarea
  rows={4}
  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
  placeholder="Enter notes..."
/>
```

### 5. Icon Badges

**Gradient Icon Badge**
```tsx
<div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
  <Icon className="w-6 h-6 text-white" />
</div>
```

**Avatar with Initials**
```tsx
<div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-semibold">
  AU
</div>
```

### 6. Alert Boxes

**Warning Alert**
```tsx
<div className="p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
  <div className="flex gap-3">
    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
    <div className="text-sm">Warning message goes here</div>
  </div>
</div>
```

**Error Alert**
```tsx
<div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
  <div className="flex gap-3">
    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
    <div className="text-sm">Error message goes here</div>
  </div>
</div>
```

**Info Alert**
```tsx
<div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
  <div className="flex gap-3">
    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
    <div className="text-sm">Info message goes here</div>
  </div>
</div>
```

### 7. Stats Cards

**KPI Card**
```tsx
<div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
  <div className="flex items-center justify-between mb-4">
    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="flex items-center gap-1 text-green-400 text-sm">
      <TrendingUp className="w-4 h-4" />
      +12%
    </div>
  </div>
  <div className="text-3xl font-bold mb-1">248</div>
  <div className="text-sm text-gray-400">Total Vehicles</div>
</div>
```

### 8. Tables

**Data Table**
```tsx
<div className="bg-[#0f1420] border border-gray-800 rounded-xl overflow-hidden">
  <table className="w-full">
    <thead className="bg-gray-800/50 border-b border-gray-800">
      <tr>
        <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Column 1</th>
        <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Column 2</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-gray-800 hover:bg-gray-800/30 transition-all">
        <td className="px-6 py-4">Data 1</td>
        <td className="px-6 py-4">Data 2</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 9. Progress Bars

**Gradient Progress Bar**
```tsx
<div>
  <div className="flex justify-between text-sm mb-2">
    <span className="text-gray-400">Capacity</span>
    <span className="font-medium">72%</span>
  </div>
  <div className="w-full bg-gray-800 rounded-full h-2">
    <div 
      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all" 
      style={{ width: '72%' }}
    />
  </div>
</div>
```

### 10. Navigation Tabs

**Horizontal Tabs**
```tsx
<div className="flex gap-2 border-b border-gray-800">
  <button className="px-6 py-3 font-medium text-blue-400 border-b-2 border-blue-400">
    Active Tab
  </button>
  <button className="px-6 py-3 font-medium text-gray-400 hover:text-gray-300">
    Inactive Tab
  </button>
</div>
```

**Vertical Tabs (Sidebar Style)**
```tsx
<nav className="space-y-2">
  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600 text-white">
    <Icon className="w-5 h-5" />
    <span className="text-sm font-medium">Active Item</span>
  </button>
  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800/50">
    <Icon className="w-5 h-5" />
    <span className="text-sm font-medium">Inactive Item</span>
  </button>
</nav>
```

---

## 🏗️ Layout Patterns

### Page Container
```tsx
<div className="p-8">
  {/* Page content */}
</div>
```

### Page Header
```tsx
<div className="flex items-center justify-between mb-8">
  <div>
    <h1 className="text-2xl font-semibold mb-2">Page Title</h1>
    <p className="text-gray-400">Page description</p>
  </div>
  <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
    Primary Action
  </button>
</div>
```

### Grid Layouts

**2 Columns**
```tsx
<div className="grid grid-cols-2 gap-6">
  <div>{/* Column 1 */}</div>
  <div>{/* Column 2 */}</div>
</div>
```

**3 Columns (2/3 - 1/3 Split)**
```tsx
<div className="grid grid-cols-3 gap-6">
  <div className="col-span-2">{/* Main content */}</div>
  <div>{/* Sidebar */}</div>
</div>
```

**4 Columns**
```tsx
<div className="grid grid-cols-4 gap-6">
  <div>{/* Col 1 */}</div>
  <div>{/* Col 2 */}</div>
  <div>{/* Col 3 */}</div>
  <div>{/* Col 4 */}</div>
</div>
```

### Sidebar Navigation

**Icon Sidebar (80px wide)**
```tsx
<div className="w-20 bg-[#0f1420] border-r border-gray-800 flex flex-col items-center py-6">
  {/* Logo */}
  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-8">
    <Car className="w-6 h-6 text-white" />
  </div>

  {/* Navigation */}
  <nav className="flex-1 flex flex-col gap-4 w-full px-3">
    <button className="w-full h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
      <Home className="w-5 h-5" />
    </button>
    <button className="w-full h-12 rounded-xl bg-gray-800/30 hover:bg-gray-700/50 text-gray-400 flex items-center justify-center">
      <Icon className="w-5 h-5" />
    </button>
  </nav>
</div>
```

### Top Bar

```tsx
<div className="h-16 bg-[#0f1420] border-b border-gray-800 px-8 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <h1 className="text-xl font-semibold">Automotive Management</h1>
  </div>

  <div className="flex items-center gap-4">
    {/* Search */}
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg">
      <Search className="w-4 h-4 text-gray-400" />
      <span className="text-sm text-gray-400">Search...</span>
    </div>

    {/* Notifications */}
    <button className="relative w-10 h-10 rounded-lg bg-gray-800/50 flex items-center justify-center">
      <Bell className="w-5 h-5 text-gray-400" />
      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">3</span>
    </button>

    {/* User Profile */}
    <div className="flex items-center gap-3 pl-4 border-l border-gray-700">
      <div className="text-right">
        <div className="text-sm">Admin User</div>
        <div className="text-xs text-gray-400">Manager</div>
      </div>
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        AU
      </div>
    </div>
  </div>
</div>
```

---

## 🎬 Complete Component Examples

### Service Bay Grid

```tsx
<div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
  <h3 className="text-lg font-semibold mb-6">Service Bay Status</h3>
  <div className="grid grid-cols-6 gap-4">
    {/* In Use Bay */}
    <div className="p-4 rounded-lg border-2 border-blue-500 bg-blue-900/20">
      <div className="text-center">
        <div className="text-2xl font-bold mb-1">Bay 1</div>
        <div className="text-xs text-blue-400 mb-2">In Use</div>
        <div className="text-xs text-gray-500">
          Camry
          <div className="text-gray-600">J-1001</div>
        </div>
      </div>
    </div>

    {/* Available Bay */}
    <div className="p-4 rounded-lg border-2 border-gray-700 bg-gray-800/20">
      <div className="text-center">
        <div className="text-2xl font-bold mb-1">Bay 2</div>
        <div className="text-xs text-gray-400">Available</div>
      </div>
    </div>

    {/* Cleaning Bay */}
    <div className="p-4 rounded-lg border-2 border-orange-500 bg-orange-900/20">
      <div className="text-center">
        <div className="text-2xl font-bold mb-1">Bay 5</div>
        <div className="text-xs text-orange-400">Cleaning</div>
      </div>
    </div>
  </div>
</div>
```

### List Item with Icon

```tsx
<button className="w-full flex items-center gap-4 p-4 bg-gray-800/30 hover:bg-gray-800/50 rounded-lg transition-all text-left">
  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-sm font-medium">
    1001
  </div>
  <div className="flex-1">
    <div className="font-medium">John Smith</div>
    <div className="text-sm text-gray-400">2024 Toyota Camry</div>
  </div>
  <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700/50">
    In Progress
  </span>
</button>
```

### Detail Page Header

```tsx
<div className="flex items-center gap-4 mb-8">
  <button className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center">
    <ArrowLeft className="w-5 h-5" />
  </button>
  <div className="flex-1">
    <h1 className="text-2xl font-semibold mb-1">Job J-1001</h1>
    <p className="text-gray-400">Oil Change + Inspection</p>
  </div>
  <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-2">
    <FileText className="w-5 h-5" />
    Create Quote
  </button>
</div>
```

### Activity Timeline

```tsx
<div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
  <div className="flex items-center gap-3 mb-6">
    <Activity className="w-6 h-6 text-blue-400" />
    <h2 className="text-lg font-semibold">Activity Timeline</h2>
  </div>
  <div className="space-y-4">
    <div className="flex gap-4">
      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
      <div className="flex-1">
        <div className="text-sm text-gray-300">Job status updated to In Progress</div>
        <div className="text-xs text-gray-500 mt-1">2026-05-04 11:30 AM • Mike T.</div>
      </div>
    </div>
  </div>
</div>
```

---

## 🎯 Common Patterns Summary

### Hover States
- Cards: `hover:bg-gray-800/30` or `hover:border-gray-700`
- Buttons: `hover:bg-blue-700` or `hover:bg-gray-700`
- Always include `transition-all` for smooth animations

### Border Radius
- Small elements (badges, pills): `rounded-lg` (8px)
- Cards and containers: `rounded-xl` (12px)
- Avatars: `rounded-full`

### Shadows
- Generally avoided in favor of borders
- Use subtle borders (`border-gray-800`) instead of shadows

### Spacing
- Card padding: `p-6` (24px)
- Section gaps: `gap-6` (24px)
- Page padding: `p-8` (32px)
- Item spacing: `space-y-3` or `space-y-4`

---

## 🚀 Quick Start Templates

### Basic Page Template

```tsx
export default function PageName() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Page Title</h1>
          <p className="text-gray-400">Page description</p>
        </div>
        <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
          Primary Action
        </button>
      </div>

      {/* Content */}
      <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6">
        {/* Page content goes here */}
      </div>
    </div>
  );
}
```

### List Page Template

```tsx
export default function ListPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Items</h1>
          <p className="text-gray-400">Manage all items</p>
        </div>
        <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center gap-2">
          <Plus className="w-5 h-5" />
          New Item
        </button>
      </div>

      {/* Search */}
      <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <button className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f1420] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          {/* Table content */}
        </table>
      </div>
    </div>
  );
}
```

---

## 📱 Responsive Considerations

While this UI is primarily desktop-focused, here are mobile considerations:

```tsx
/* Mobile-friendly grid (stack on mobile) */
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Columns */}
</div>

/* Hide on mobile */
<div className="hidden md:block">
  {/* Desktop-only content */}
</div>

/* Mobile padding */
<div className="p-4 md:p-8">
  {/* Adaptive padding */}
</div>
```

---

## ✅ UI Checklist

When creating a new page, ensure:

- [ ] Background is `#0a0e1a`
- [ ] Cards use `#0f1420` with `border-gray-800`
- [ ] Text colors follow the hierarchy (white → gray-400 → gray-500)
- [ ] All interactive elements have hover states
- [ ] Buttons include `transition-all`
- [ ] Icons are 16px (`w-4 h-4`) or 20px (`w-5 h-5`)
- [ ] Spacing is consistent (p-6 for cards, p-8 for pages)
- [ ] Status badges use the color/opacity pattern
- [ ] Gradients use the blue-purple theme
- [ ] Tables have alternating row hover effects

---

## 🎨 Color Usage Guide

| Element | Color | Class |
|---------|-------|-------|
| Page background | #0a0e1a | `bg-[#0a0e1a]` |
| Cards/Panels | #0f1420 | `bg-[#0f1420]` |
| Card borders | Gray-800 | `border-gray-800` |
| Input backgrounds | Gray-800 50% | `bg-gray-800/50` |
| Primary text | Gray-100 | `text-gray-100` |
| Secondary text | Gray-400 | `text-gray-400` |
| Muted text | Gray-500 | `text-gray-500` |
| Success | Green-400 | `text-green-400` |
| Warning | Yellow-400 | `text-yellow-400` |
| Error | Red-400 | `text-red-400` |
| Info | Blue-400 | `text-blue-400` |

---

**End of UI Design System Documentation**

This guide provides everything needed to recreate the automotive management platform's UI pixel-perfectly. All patterns, colors, spacing, and components follow this exact specification.
