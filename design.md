# Design — A2Z practice workspace

Locked system for the roadmap, authentication and practice journal. Extend this file rather than inventing a theme per page.

## Genre and structure
Modern-minimal, utilitarian. App pages use Index-First: a compact heading, meaningful filters and lists of actual questions. Authentication uses the same type and controls in a narrow form. No marketing pages, decorative imagery or invented metrics.

- Navigation: N3 adapted into a readable text side rail; two destinations (Roadmap / Practice journal), horizontal on mobile. No rotated text or hidden navigation.
- Footer: Ft2 single-line attribution.
- Theme: Coral-family restrained warm paper, ink primary buttons, dark coral signal accent. No chromatic floods.
- Typography: self-hosted Geist Variable, 400 body / 600 headings / 650 wordmark. One-family discipline intentionally keeps dense study content quiet. Tracking -0.035em for headings. Main heading clamp(1.75rem, 3vw, 2.25rem).
- Spacing: named 4-point scale in `tokens.css` (4, 8, 12, 16, 24, 32, 48, 64px).
- Motion: cut. No reveals, bouncing counters or animation library. Immediate hover, focus and pending feedback; reduced-motion explicitly supported.
- CTA: ink fill, light text, 6px corners; specific verbs. Secondary outline or plain text, never ambiguous “OK”.
- Success: quiet inline feedback. Failed saves retain notes. Destructive deletion requires an explicit inline confirmation.
- Fields: visible labels, native date/select controls, minimum 44px height, outline focus without border-width shifts.
- Mobile: no page overflow; roadmap rows become stacked question/resource rows. Long curriculum titles may wrap (readability takes precedence over single-line controls).

## Shared boundaries
Keep authentication, stable problem IDs, curriculum, solved progress and legacy imports. Journal attempts are independent of solved status. Each user sees only their own entries. No UI change deletes existing data.

## Journal semantics
Multiple dated attempts per question. Outcome, minutes, confidence (1–5), approach, mistakes and optional next revision date. The newest attempt by practice date (creation time, then ID, break ties) owns that question’s current reminder. A new attempt supersedes older reminders; clearing its reminder does not delete history. Dates are calendar dates; “due” uses the browser’s local today. Backdated attempts do not displace newer practice. Deleting the latest attempt may restore the previous attempt’s reminder.

## Implementation and review
- `app/layout.tsx` loads the original stylesheet, self-hosted font, `tokens.css`, then additive `app/workspace.css`. The old stylesheet is preserved, with its token API mapped to the new system.
- Automated checks: axe accessibility scans on roadmap, registration, journal, and editor; responsive geometry/screenshot checks at 320/375/414/768/1280px. Source review found no gradients, ornamental cards, fake metrics, fake browser chrome, or motion dependencies.
- Intentional content exception: long curriculum disclosure titles and question links wrap on mobile rather than being truncated. Primary navigation, tabs, and action labels remain single-line.
- Human visual review remains open: this coding environment cannot inspect screenshot pixels. Do not interpret automated geometry checks as a pixel-level design approval.

## Exports
`tokens.css` is the runtime and portable source of truth for all colors, fonts, sizes, spacing and radii. The project uses plain CSS, not Tailwind or shadcn; their mappings are documented below for reuse.

```css
/* Tailwind v4 adapter — import the source tokens first. */
@theme inline {
  --color-background: var(--color-paper);
  --color-foreground: var(--color-ink);
  --color-primary: var(--color-accent);
  --font-sans: var(--font-body);
  --spacing-md: var(--space-md);
}
/* shadcn adapter */
:root {
  --background: var(--color-paper);
  --foreground: var(--color-ink);
  --primary: var(--color-accent);
  --primary-foreground: var(--color-accent-ink);
  --muted: var(--color-paper-2);
  --muted-foreground: var(--color-muted);
  --border: var(--color-rule);
  --input: var(--color-control);
  --ring: var(--color-focus);
  --radius: var(--radius-input);
}
```

```json
{
  "color": {
    "paper": { "$value": "oklch(98% 0.004 65)", "$type": "color" },
    "ink": { "$value": "oklch(24% 0.008 65)", "$type": "color" },
    "accent": { "$value": "oklch(48% 0.15 32)", "$type": "color" }
  },
  "font": { "body": { "$value": "Geist Variable", "$type": "fontFamily" } },
  "space": { "md": { "$value": "1.5rem", "$type": "dimension" } }
}
```
