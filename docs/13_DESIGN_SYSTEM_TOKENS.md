# Design System / Tokens Documentation

## Design principles

- Use spacing and typography before decoration.
- Keep panels clear and scannable.
- Use color mostly for status.
- Prefer rows over dense tables for MVP.

## Color tokens

```ts
export const colors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  accent: '#2563EB',
  accentSoft: '#DBEAFE',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
}
```

## Typography

```ts
export const typography = {
  fontSans: 'Inter, ui-sans-serif, system-ui, sans-serif',
  pageTitle: 'text-2xl font-semibold tracking-tight',
  sectionTitle: 'text-sm font-semibold',
  body: 'text-sm',
  small: 'text-xs',
  code: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}
```

## Spacing

```ts
export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
}
```

## Radius

```ts
export const radius = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
}
```

## Shadows

```ts
export const shadows = {
  panel: '0 1px 2px rgba(15, 23, 42, 0.06)',
  floating: '0 8px 24px rgba(15, 23, 42, 0.12)',
}
```

## Status colors

```ts
export const statusColors = {
  active: 'success',
  paused: 'warning',
  failed: 'danger',
  dryRun: 'textMuted',
  live: 'accent',
}
```

## Component sizing

- Sidebar width: `280px` to `340px`
- Main panel max width: flexible
- Prompt textarea min height: `180px`
- Body output min height: `400px`
- Row height: `44px` minimum

## Tailwind token mapping

Use Tailwind config or CSS variables:

```css
:root {
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-border: #E2E8F0;
  --color-text: #0F172A;
  --color-muted: #64748B;
  --color-accent: #2563EB;
}
```
