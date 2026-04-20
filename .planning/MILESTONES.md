# Milestones

## v1.2 Estimates System (Shipped: 2026-04-20)

**Phases completed:** 4 phases, 8 plans, 9 tasks

**Key accomplishments:**

- Drizzle estimates table + discriminatedUnion Zod types for JSONB service snapshot, wired into shared barrel
- Six typed DatabaseStorage CRUD methods for estimates + estimates table created in PostgreSQL via idempotent SQL migration
- One-liner:
- Estimates tab wired into the admin dashboard — AdminSection union extended, sidebar menu item added with Receipt icon, both slug maps updated, and /admin/estimates renders EstimatesSection
- Fullscreen scroll-snap estimate viewer at /e/:slug with access code gate, view tracking, IntersectionObserver nav dots, and graceful 404 — isolated from Navbar/Footer/ChatWidget

---
