# FOGUS — Figma Design System Rules

> Generated for Figma MCP integration. Use this document when implementing designs from Figma into this codebase.

---

## 1. Token Definitions

Design tokens are defined as CSS custom properties in [`src/app/globals.css`](../src/app/globals.css) using the **OKLCH color space** and are mapped into Tailwind v4 via `@theme inline`.

### Color Tokens (CSS vars → Tailwind utility)

| Token | Light | Dark | Tailwind Class |
|---|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | `bg-background` |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | `text-foreground` |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | `bg-primary` |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | `text-primary-foreground` |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | `bg-secondary` |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | `bg-muted` |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | `text-muted-foreground` |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | `bg-accent` |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | `bg-destructive` |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | `border-border` |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | `ring-ring` |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | `bg-card` |

### Border Radius Tokens

Base radius: `--radius: 0.625rem`

| Token | Value | Tailwind |
|---|---|---|
| `--radius-sm` | `calc(var(--radius) * 0.6)` ≈ 6px | `rounded-sm` |
| `--radius-md` | `calc(var(--radius) * 0.8)` ≈ 8px | `rounded-md` |
| `--radius-lg` | `var(--radius)` = 10px | `rounded-lg` |
| `--radius-xl` | `calc(var(--radius) * 1.4)` ≈ 14px | `rounded-xl` |
| `--radius-2xl` | `calc(var(--radius) * 1.8)` ≈ 18px | `rounded-2xl` |

### Typography

- Font: **Geist** (loaded via `next/font/google` in `src/app/layout.tsx`)
- CSS variable: `--font-sans` → maps to `--font-heading` as well
- Applied globally: `html { @apply font-sans; }`

---

## 2. Component Library

Components live in [`src/components/`](../src/components/):

```
src/components/
├── ui/                     # Primitive shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── label.tsx
├── login-form.tsx          # Composed feature components
├── sign-up-form.tsx
├── forgot-password-form.tsx
├── logout-button.tsx
└── update-password-form.tsx
```

### Pattern: shadcn/ui primitives + CVA variants

```tsx
// Example from src/components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center ...",   // base classes
  {
    variants: {
      variant: { default: "...", outline: "...", destructive: "...", ghost: "...", link: "..." },
      size:    { default: "h-8 ...", sm: "h-7 ...", lg: "h-9 ...", icon: "size-8" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

### Pattern: `data-slot` attributes

All shadcn components use `data-slot` for CSS targeting:

```tsx
<div data-slot="card" />
<div data-slot="card-header" />
<div data-slot="card-content" />
<div data-slot="card-footer" />
<button data-slot="button" data-variant={variant} data-size={size} />
```

---

## 3. Frameworks & Libraries

| Category | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | ^16.2.0 |
| UI Library | React | ^19.1.0 |
| Styling | Tailwind CSS v4 | ^4.1.0 |
| Component primitives | shadcn/ui + radix-ui | ^1.4.3 |
| Variant system | class-variance-authority (CVA) | ^0.7.1 |
| Class merging | clsx + tailwind-merge | latest |
| Icons | lucide-react | ^1.8.0 |
| Animations | tw-animate-css | ^1.4.0 |
| LINE LIFF | @line/liff (CDN via script tag) | v2.28 |
| Auth & DB | Supabase | ^2.103.0 |

---

## 4. Asset Management

- No `public/` asset directory is actively used at this time.
- LIFF (LINE) loads the LIFF SDK via `<Script>` tag on the client.
- Images in LIFF forms may include user-uploaded reference images passed as URLs/base64 in API bodies.

---

## 5. Icon System

Icons come from **lucide-react**:

```tsx
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react"

// Usage — size controlled by className or SVG size tokens
<CheckCircle className="size-4 text-green-500" />
```

- Default icon size in Button: `[&_svg:not([class*='size-'])]:size-4`
- Naming follows lucide-react PascalCase exports

---

## 6. Styling Approach

### Method: Tailwind CSS v4 utility-first

- No CSS Modules, no Styled Components
- Global tokens in [`src/app/globals.css`](../src/app/globals.css) via `@theme inline` and CSS custom properties
- Component-level styling via `cn()` helper (clsx + tailwind-merge)

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Global layout classes

Two shell/panel pairs define the major surface areas:

```css
/* LIFF (customer-facing LINE Mini App) */
.liff-shell  /* full-viewport gradient background */
.liff-panel  /* frosted glass card: blur, rounded-3xl, white/94% */

/* Admin (internal ERP dashboard) */
.admin-shell      /* dark header band + light body gradient */
.admin-panel      /* white card: rounded-2xl, shadow */
.admin-kpi-card   /* stat card variant */
```

### Responsive design

- Mobile-first via Tailwind breakpoints (`sm:`, `md:`, `lg:`)
- LIFF pages must account for LINE safe-area insets (`env(safe-area-inset-*)`)
- Admin pages target desktop-first layouts

### Dark mode

- Activated by adding `.dark` class to a parent element (not `prefers-color-scheme` media query)
- Custom variant declared: `@custom-variant dark (&:is(.dark *))`

---

## 7. Project Structure

```
src/
├── app/
│   ├── admin/              # Internal ERP admin pages (server + client actions)
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── settings/
│   │   └── *-actions.tsx   # Server Actions (admin workflows)
│   ├── api/                # Next.js Route Handlers (REST endpoints)
│   │   ├── intake/
│   │   ├── jobs/[id]/
│   │   ├── leads/[id]/
│   │   ├── quotes/[id]/
│   │   └── webhook/
│   ├── flow/               # Workflow visualization page
│   ├── liff/               # LINE LIFF mini-app pages
│   │   ├── layout.tsx      # LIFF shell with safe-area padding
│   │   └── intake/         # Customer intake form
│   ├── quote/[token]/      # Public quote approval page
│   ├── status/[token]/     # Public job status page
│   ├── globals.css         # Token definitions + global styles
│   └── layout.tsx          # Root layout (font, lang="th")
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   └── *.tsx               # Composed feature components
└── lib/
    ├── utils.ts            # cn() helper
    ├── types.ts            # Canonical workflow types + enums
    ├── quote-workflow.ts   # Approval/payment gate logic
    ├── workflow-policy.ts  # Policy helpers (TypeScript)
    ├── workflow-policy-core.mjs  # Policy helpers (ESM)
    └── supabase/           # Supabase client factories
```

### Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Pages | `page.tsx` inside route folder | `src/app/admin/page.tsx` |
| Layouts | `layout.tsx` inside route folder | `src/app/liff/layout.tsx` |
| Server Actions | `*-actions.tsx` | `quote-actions.tsx` |
| UI primitives | kebab-case in `ui/` | `button.tsx`, `card.tsx` |
| Feature components | kebab-case | `login-form.tsx` |
| Lib helpers | kebab-case | `quote-workflow.ts` |

---

## 8. Figma → Code Translation Rules

When receiving designs from Figma for this project:

1. **Colors**: Map Figma color styles to `--color-*` CSS variables (e.g., Figma "Primary" → `bg-primary`). Never hardcode hex values.

2. **Border radius**: Map to `rounded-*` Tailwind classes using the token table above. LIFF panels use `rounded-3xl` (24px); admin panels use `rounded-2xl` (20px); KPI cards use `rounded-2xl` (18px).

3. **Shadows**: Admin uses `shadow: 0 18-20px 40-48px rgba(15,23,42,0.08)` — use `shadow-lg` or custom box-shadow via globals; LIFF panels add `backdrop-filter: blur(14px)`.

4. **Components**: Before building a new component, check `src/components/ui/` for an existing shadcn primitive. Extend via `className` + `cn()`, not new files.

5. **LIFF pages**: Always wrap content in `.liff-shell` + `.liff-panel`. Preserve `env(safe-area-inset-*)` padding. Language is Thai (`lang="th"`).

6. **Admin pages**: Use `.admin-shell` + `.admin-panel`. KPI cards use `.admin-kpi-card`.

7. **Icons**: Use lucide-react. Match Figma icon names to lucide exports (PascalCase).

8. **Typography**: Geist font only. Use Tailwind `text-*` scale and `font-medium`/`font-semibold` weights. `font-heading` = `font-sans` (same family).

9. **Interactive states**: Buttons handle hover/focus/disabled via CVA variants. Do not override focus-visible ring styles — they use `--ring` token.

10. **Locale**: UI strings may be in Thai. Do not change language or locale in generated code.
