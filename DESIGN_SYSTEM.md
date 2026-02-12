# Design System - Skale Club

Unified design system for the Skale Club platform, including brand identity, technical components, and guidelines for both public frontend and admin dashboard.

**Last updated**: January 2026

---

## 📌 Table of Contents

1. [Brand Identity](#brand-identity)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing and Layout](#spacing-and-layout)
5. [Technical Components (Admin)](#technical-components-admin)
6. [Public Frontend (Customer Platform)](#public-frontend-customer-platform)
7. [Best Practices](#best-practices)

---

## Brand Identity

### Core Essence
Skale Club is a professional marketing service platform that emphasizes trust, quality, and ease of use.

### Brand Voice
- Simple, everyday language
- Professional yet accessible
- Focus on the result: "spotless space" and "peace of mind"

### Brand Colors

#### Primary Blue - `#1C53A3`
- HSL: `215 71% 37%`
- **Usage**: Hero backgrounds, headers, primary branding elements
- **Meaning**: Trust, reliability, cleanliness
- **Dark Mode**: `#3B82F6` (217 91% 60%) - Lighter blue for contrast

#### Brand Yellow - `#FFFF01`
- HSL: `60 100% 50%`
- **Usage**: CTA buttons, highlights, important accents
- **Required**: All "Book Now" and "Instant Price" buttons
- **Hover**: `#e6e600` (slightly darker yellow)
- **Same color** in dark mode

#### Text Colors
- **Primary**: `#1D1D1D` (light mode) / `#F1F5F9` (dark mode)
- **Secondary**: Gray shades for descriptions and metadata

---

## Color System

### Light Mode

#### Backgrounds
- **Background**: `#FFFFFF` - Main background
- **Card**: `#FFFFFF` - Card backgrounds
- **Section**: `#F8FAFC` (slate-50) - Grouped section backgrounds
- **Muted**: `#F1F5F9` (slate-100) - Secondary backgrounds
- **Sidebar**: `#FFFFFF` - Sidebar background

#### Text
- **Foreground**: `#1D1D1D` - Primary text
- **Muted Foreground**: `#64748B` - Secondary text

#### Status
- **Success**: `#059669` (142 76% 36%) - Green for successful actions
- **Warning**: `#F59E0B` (38 92% 50%) - Yellow for warnings
- **Destructive**: `#DC2626` (0 84% 60%) - Red for destructive actions

#### UI Elements
- **Border**: `#E2E8F0` - Default borders
- **Input**: `#E2E8F0` - Input backgrounds

---

### Dark Mode

#### Backgrounds
- **Background**: `#0F172A` (slate-900) - Main background
- **Card**: `#1E293B` (slate-800) - Card backgrounds
- **Section**: `#0F172A` (slate-900) - Section backgrounds
- **Muted**: `#1E293B` (slate-800) - Secondary backgrounds
- **Sidebar**: `#1E293B` (slate-800) - Sidebar background

#### Text
- **Foreground**: `#F1F5F9` (slate-50) - Primary text
- **Muted Foreground**: `#94A3B8` (slate-400) - Secondary text

#### Status
- **Success**: `#10B981` (142 71% 45%) - Green adjusted for dark mode
- **Warning**: `#F59E0B` (38 92% 50%) - Yellow unchanged
- **Destructive**: `#EF4444` (0 62% 50%) - Red adjusted

#### UI Elements
- **Border**: `#334155` (slate-700) - Default borders
- **Input**: `#1E293B` (slate-800) - Input backgrounds

---

## Typography

### Fonts
- **Display/Headings**: `Outfit` (sans-serif) - Modern look with tight tracking
- **Body**: `Inter` (sans-serif) - Maximum readability for UI and body text

### Typographic Scale

#### Admin Dashboard
- **H1**: 2rem (32px) - `text-2xl font-bold`
- **H2**: 1.5rem (24px) - `text-xl font-semibold`
- **H3**: 1.25rem (20px) - `text-lg font-semibold`
- **Body**: 0.875rem (14px) - `text-sm`
- **Small**: 0.75rem (12px) - `text-xs`

#### Public Frontend
- **Hero Heading**: `text-5xl md:text-6xl font-bold tracking-tight`
- **Section Heading**: `text-3xl md:text-4xl font-bold`
- **Card Title**: `text-xl font-semibold`
- **Body**: `text-base font-normal`
- **Small/Meta**: `text-sm text-gray-600`

---

## Spacing and Layout

### Spacing Primitives
Tailwind units: 4, 6, 8, 12, 16, 24

#### Admin
- **Card padding**: `p-6` (24px)
- **Section padding**: `p-6` (24px)
- **Element spacing**: `space-y-4` (16px)
- **Form spacing**: `space-y-4` (16px)
- **Grid gaps**: `gap-4` (16px)

#### Public Frontend
- **Component padding**: `p-6` or `p-8`
- **Section spacing**: `py-16 md:py-24`
- **Card gaps**: `gap-6` or `gap-8`

### Container Widths
- **Marketing sections**: `max-w-7xl`
- **Booking forms**: `max-w-2xl`
- **Admin content**: `max-w-full` with sidebar

### Border Radius
- `rounded-sm` - 3px
- `rounded-md` - 6px
- `rounded-lg` - 9px
- `rounded-xl` - 12px
- `rounded-2xl` - 16px (public frontend cards)
- `rounded-full` - Circle/Pill (main CTAs)

---

## Technical Components (Admin)

### Utility Classes

#### Cards
```css
.admin-card
/* bg-card text-card-foreground rounded-lg border border-border p-6 */
```

```jsx
<div className="admin-card">Card content</div>
```

#### Sections
```css
.admin-section
/* bg-muted rounded-lg p-6 space-y-4 */
```

```jsx
<div className="admin-section">
  <h2>Section Title</h2>
  {/* content */}
</div>
```

#### Forms

**Form Group**
```css
.admin-form-group
/* space-y-4 */
```

**Form Field**
```css
.admin-form-field
/* space-y-2 */
```

**Form Grid (2 columns)**
```css
.admin-form-grid
/* grid gap-4 sm:grid-cols-2 */
```

**Complete example:**
```jsx
<form className="admin-form-group">
  <div className="admin-form-grid">
    <div className="admin-form-field">
      <Label>Name</Label>
      <Input />
    </div>
    <div className="admin-form-field">
      <Label>Email</Label>
      <Input />
    </div>
  </div>
</form>
```

#### Page Headers
```css
.admin-page-header  /* mb-6 */
.admin-page-title   /* text-2xl font-bold text-foreground */
.admin-page-subtitle /* text-muted-foreground mt-1 */
```

```jsx
<div className="admin-page-header">
  <h1 className="admin-page-title">Dashboard</h1>
  <p className="admin-page-subtitle">System overview</p>
</div>
```

#### Stat Cards
```css
.admin-stat-card
/* bg-card rounded-lg p-6 border border-border */
```

#### Actions
```css
.admin-actions
/* flex items-center gap-2 */
```

```jsx
<div className="admin-actions">
  <Button variant="outline" size="sm">Edit</Button>
  <Button variant="destructive" size="sm">Delete</Button>
</div>
```

#### Status Badges
```css
.admin-badge-success   /* bg-success/10 text-success border-success/20 */
.admin-badge-warning   /* bg-warning/10 text-warning border-warning/20 */
.admin-badge-error     /* bg-destructive/10 text-destructive border-destructive/20 */
```

### shadcn/ui Components

#### Button

**Variants:**
- `default` - Primary blue
- `destructive` - Destructive red
- `outline` - Border with transparent background
- `secondary` - Brand yellow
- `ghost` - No border or background

**Sizes:**
- `sm` - Small (32px)
- `default` - Default (36px)
- `lg` - Large (40px)
- `icon` - Square (36px)

```jsx
<Button variant="default" size="default">Save</Button>
<Button variant="destructive" size="sm">Delete</Button>
<Button variant="outline">Cancel</Button>
```

#### Badge

**Variants:**
- `default` - Primary blue
- `secondary` - Brand yellow
- `destructive` - Destructive red
- `success` - Success green
- `warning` - Warning yellow
- `outline` - Border with transparent background

```jsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Cancelled</Badge>
```

#### Input / Textarea / Select

All inputs follow the same pattern:
- `bg-background` - Theme-adaptive background
- `border-input` - Adaptive border
- `text-foreground` - Adaptive text
- `placeholder:text-muted-foreground` - Secondary placeholder

```jsx
<Input placeholder="Type here..." />
<Textarea placeholder="Description..." />
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
  </SelectContent>
</Select>
```

#### Card

```jsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

#### Dialog / AlertDialog

```jsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Theme Toggle

The system includes a `ThemeToggle` component with 3 variants:

#### Icon (default)
```jsx
<ThemeToggle variant="icon" />
```

#### Switch with labels
```jsx
<ThemeToggle variant="switch" />
```

#### Dropdown with options (light/dark/system)
```jsx
<ThemeToggle variant="dropdown" />
```

### Theme Hook

```jsx
import { useTheme } from '@/context/ThemeContext';

function MyComponent() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  // theme: 'light' | 'dark' | 'system'
  // resolvedTheme: 'light' | 'dark' (without 'system')

  return (
    <div>
      <p>Current theme: {resolvedTheme}</p>
      <button onClick={toggleTheme}>Toggle theme</button>
      <button onClick={() => setTheme('dark')}>Dark mode</button>
    </div>
  );
}
```

### Custom CSS Variables

All system colors are available as CSS variables:

```css
/* Use in CSS files */
.custom-element {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border: 1px solid hsl(var(--border));
}
```

```jsx
/* Or via Tailwind */
<div className="bg-card text-card-foreground border border-border">
  Content
</div>
```

### Transitions

All elements that change color with the theme include smooth transitions:

```css
transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
```

Apply with: `transition-colors duration-200`

---

## Public Frontend (Customer Platform)

### Design Approach

**Inspiration**: Airbnb (approachable booking aesthetic) + Stripe (professional restraint)

### Page Structure

#### Hero Section (100vh)

Large hero image showing professional cleaners in modern home setting with bright natural lighting. Conveys trust and cleanliness.

**Overlay Content (centered):**
- Large heading: "Professional Cleaning, Delivered"
- Subheading with value proposition
- Instant booking widget card (elevated with `backdrop-blur-xl bg-white/90`):
  - Service type dropdown
  - Location/address input
  - Date/time selector
  - "Get Instant Quote" CTA button (Brand Yellow)

#### Services Grid (3 columns desktop, 1 column mobile)

Cards with:
- Icon at top (Heroicons)
- Service name
- Brief description
- Starting price
- "Book Now" link

#### How It Works (4 steps)

Horizontal timeline (desktop) / vertical (mobile) with numbered steps, icons, and concise descriptions

#### Pricing Cards (3 columns)

Tiered packages (Basic/Standard/Premium) with:
- Package name and price
- Feature list with checkmarks
- Prominent CTA button
- "Most Popular" badge on middle tier

#### Trust Section (2 columns split)

**Left:** Customer testimonials carousel with photos
**Right:** Trust metrics (cleanings completed, satisfaction rate, insured professionals)

#### Footer

Multi-column layout with quick links, contact info, social icons, newsletter signup

### Booking Flow Pages

#### Service Selection
Grid of service cards with large images, checkboxes for multi-select, sticky summary sidebar

#### Address & Schedule
Split layout: Map preview left, form right with calendar picker and time slots

#### Customization
Checklist-style options with add-ons, special instructions textarea

#### Confirmation
Clean receipt-style summary with booking details, professional assigned (photo + name), contact options

### Frontend Component Specifications

#### Buttons
- **Primary CTA**: Brand Yellow (`#FFFF01`) with black bold text, `rounded-full` (pill shape)
- **Secondary**: Outlined version, `rounded-lg`
- **Text buttons**: For tertiary actions
- **Buttons on images**: `backdrop-blur-md bg-white/20 text-white`

#### Form Inputs
- Consistent height: `h-12`
- Border radius: `rounded-lg`
- Focus states with ring offset

#### Cards
- White background
- `rounded-xl` or `rounded-2xl`
- `shadow-sm` with `hover:shadow-md` transition
- Generous padding (`p-6` or `p-8`)

#### Status Badges
Small `rounded-full` pills with colored backgrounds:
- Green: Confirmed
- Yellow: Pending
- Red: Cancelled

#### Modals
- Centered overlay with backdrop-blur
- `max-w-2xl`
- `rounded-2xl`
- Smooth scale animations on enter

### Required Images

1. **Hero Image**: Professional cleaners in bright modern home (full-width, 100vh)
2. **Service Cards**: 3 images showing deep cleaning, regular maintenance, move-out cleaning
3. **Testimonial Photos**: 3-4 customer headshots
4. **Cleaner Profiles**: Multiple professional photos for admin section

**Photography style**: High-quality, bright photography emphasizing cleanliness, professionalism, and trust

---

## Best Practices

### ✅ Do
- Use theme variables (`bg-card`, `text-foreground`, etc.)
- Use `admin-*` utility classes for consistency in admin
- Apply transitions to elements that change with theme
- Test UI in both themes before committing
- Use Brand Yellow (`#FFFF01`) for all main CTAs
- Apply `rounded-full` to main CTA buttons
- Maintain generous spacing (according to defined primitives)
- Follow typographic hierarchy (Outfit for headings, Inter for body)

### ❌ Avoid
- Hardcoded colors (`bg-white`, `bg-slate-100`, etc.) in admin
- Ignoring dark mode in new components
- Creating spacing variations outside the standard
- Removing focus states (accessibility)
- Using different colors from Brand Yellow for main CTAs
- Mixing fonts different from the established ones
- Creating unnecessary abstractions or over-engineering

### Checklist for New Components

#### Admin Dashboard
- [ ] Uses theme variables for colors
- [ ] Tested in light and dark mode
- [ ] Includes smooth transitions
- [ ] Follows spacing standards
- [ ] Responsive (mobile/tablet/desktop)
- [ ] Accessible (keyboard navigation, ARIA labels)
- [ ] Uses `admin-*` utility classes when applicable

#### Public Frontend
- [ ] Uses Brand Yellow for main CTAs
- [ ] Main buttons with `rounded-full`
- [ ] Optimized and high-quality images
- [ ] Follows typographic hierarchy (Outfit/Inter)
- [ ] Generous spacing according to guidelines
- [ ] Responsive and tested on multiple devices
- [ ] Smooth animations and transitions

---

## Quick Reference

### Main Colors
- **Primary Blue**: `#1C53A3` (light) / `#3B82F6` (dark)
- **Brand Yellow**: `#FFFF01` (both modes)
- **Success**: `#059669` (light) / `#10B981` (dark)
- **Warning**: `#F59E0B` (both modes)
- **Destructive**: `#DC2626` (light) / `#EF4444` (dark)

### Fonts
- **Headings**: Outfit
- **Body**: Inter

### Spacing
- Cards: `p-6`
- Sections (public): `py-16 md:py-24`
- Form spacing: `space-y-4`
- Grid gaps: `gap-4` (admin) / `gap-6` (public)

### Border Radius
- Main CTAs: `rounded-full`
- Admin cards: `rounded-lg`
- Public cards: `rounded-xl` or `rounded-2xl`

---

**Last updated**: January 2026
**Maintained by**: Skale Club Development Team
