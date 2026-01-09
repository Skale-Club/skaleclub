# Cleaning Service Booking Platform - Design Guidelines

## Design Approach

**Customer Platform:** Drawing inspiration from Airbnb's approachable service booking aesthetic with Stripe's professional restraint
**Admin Dashboard:** Linear-inspired efficiency meets modern SaaS dashboard patterns

---

## Typography System

**Font Families:**
- Primary: Inter (headings, UI elements)
- Secondary: Inter (body text, forms)

**Scale:**
- Hero Heading: text-5xl md:text-6xl, font-bold, tracking-tight
- Section Heading: text-3xl md:text-4xl, font-bold
- Card Title: text-xl, font-semibold
- Body: text-base, font-normal
- Small/Meta: text-sm, text-gray-600

---

## Layout System

**Spacing Primitives:** Tailwind units of 4, 6, 8, 12, 16, 24
- Component padding: p-6 or p-8
- Section spacing: py-16 md:py-24
- Card gaps: gap-6 or gap-8

**Container Widths:**
- Marketing sections: max-w-7xl
- Booking forms: max-w-2xl
- Admin content: max-w-full with sidebar

---

## Customer Platform Structure

### Hero Section (100vh)
Large hero image showing professional cleaners in modern home setting with bright natural lighting. Image should convey trust and cleanliness.

**Overlay Content (centered):**
- Large heading: "Professional Cleaning, Delivered"
- Subheading with value proposition
- Instant booking widget card (elevated with backdrop-blur-xl bg-white/90) containing:
  - Service type dropdown
  - Location/address input
  - Date/time selector
  - "Get Instant Quote" CTA button

### Services Grid (3-column desktop, 1-column mobile)
Cards with:
- Icon at top (from Heroicons)
- Service name
- Brief description
- Starting price
- "Book Now" link

### How It Works (4-step horizontal timeline desktop, vertical mobile)
Numbered steps with icons and concise descriptions

### Pricing Cards (3-column comparison)
Tiered packages (Basic/Standard/Premium) with:
- Package name and price
- Feature list with checkmarks
- Prominent CTA button
- "Most Popular" badge on middle tier

### Trust Section (2-column split)
Left: Customer testimonials carousel with photos
Right: Trust metrics (cleanings completed, satisfaction rate, insured professionals)

### Footer
Multi-column layout with quick links, contact info, social icons, newsletter signup

---

## Booking Flow Pages

### Service Selection
Grid of service cards with large images, checkboxes for multi-select, sticky summary sidebar

### Address & Schedule
Split layout: Map preview left, form right with calendar picker and time slots

### Customization
Checklist-style options with add-ons, special instructions textarea

### Confirmation
Clean receipt-style summary with booking details, professional assigned (photo + name), contact options

---

## Admin Dashboard

### Layout Structure
Fixed sidebar (w-64) with:
- Logo/branding at top
- Navigation menu with icons
- User profile at bottom

**Main Content Area:**
- Fixed top bar with search, notifications, user dropdown
- Content region with consistent p-8 padding

### Dashboard Home
**Stats Cards Row (4-column grid):**
- Total bookings (today)
- Revenue
- Active cleaners
- Customer satisfaction
Each with large number, label, trend indicator

**Charts Section (2-column):**
- Bookings timeline chart
- Service distribution pie chart

**Recent Activity Table:**
Clean table with alternating row backgrounds, status badges, action buttons

### Bookings Management
**Filter Bar:** Date range, status dropdown, search
**Table View:** 
- Customer name/photo
- Service type
- Date/time
- Assigned cleaner
- Status badge
- Quick actions (view/edit/cancel)

**Detail Modal:**
Full booking information with timeline, customer notes, cleaner assignment interface

### Calendar View
Week/month toggle, time-blocked schedule showing all bookings with color-coded service types

### Cleaners Management
**Grid of Cleaner Cards:**
- Profile photo
- Name and rating
- Active/available status
- Bookings count
- Performance metrics link

---

## Component Specifications

**Buttons:**
- Primary: Solid with rounded-lg, px-6 py-3
- Secondary: Outlined version
- Text buttons for tertiary actions
- Buttons on images: backdrop-blur-md bg-white/20 text-white

**Form Inputs:**
Consistent height (h-12), rounded-lg borders, focus states with ring offset

**Cards:**
White background, rounded-xl, shadow-sm with hover:shadow-md transition

**Status Badges:**
Small rounded-full pills with colored backgrounds (green/yellow/red for confirmed/pending/cancelled)

**Modals:**
Centered overlay with backdrop-blur, max-w-2xl, rounded-2xl with smooth scale animations on enter

---

## Images Required

1. **Hero Image:** Professional cleaners in bright modern home (full-width, 100vh)
2. **Service Cards:** 3 images showing deep cleaning, regular maintenance, move-out cleaning
3. **Testimonial Photos:** 3-4 customer headshots
4. **Cleaner Profiles:** Multiple professional photos for admin section

Use high-quality, bright photography emphasizing cleanliness, professionalism, and trust.