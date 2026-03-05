# Truv Web Branding Reference

Quick-reference guide for building Truv-branded web pages. All values extracted from truv.com.

## Quick Start

```html
<!-- Include in your HTML head -->
<link rel="stylesheet" href="variables.css">
<link rel="stylesheet" href="typography.css">
<link rel="stylesheet" href="components.css">
<link rel="stylesheet" href="utilities.css">
```

## Files

| File | Purpose |
|------|---------|
| `variables.css` | CSS custom properties (colors, spacing, sizing) |
| `typography.css` | Font definitions and text styles |
| `components.css` | Buttons, inputs, cards, navigation |
| `utilities.css` | Helper classes for spacing, layout, effects |
| `html-patterns.md` | HTML structure patterns and best practices |

---

## Cheat Sheet

### Colors
```css
--truv-primary: #2C64E3;      /* Buttons, CTAs */
--truv-dark: #0F1C47;         /* Headers, dark sections */
--truv-black: #171717;        /* Body text */
--truv-grey: #F4F4F2;         /* Backgrounds */
--truv-light-blue: #C5D9F7;   /* Highlights */
--truv-error: #F47F7F;        /* Errors */
```

### Spacing Scale (px)
```
4 → 8 → 14 → 16 → 24 → 28 → 32 → 48 → 64 → 71 → 128 → 178
```

### Key Dimensions
| Element | Value |
|---------|-------|
| Container max-width | 1280px |
| Header height | 57px |
| Card border-radius | 28px |
| Button border-radius | 50px (pill) |
| Button height | 50px |
| Input height | 57px |
| Section padding | 71px top, 178px bottom |
| Card padding | 28px |
| Grid gap | 14px |

### Breakpoints
| Name | Width |
|------|-------|
| Mobile | < 768px |
| Tablet | 768px - 1024px |
| Desktop | > 1024px |
| Max container | 1280px |

### Typography Scale
| Element | Size | Weight |
|---------|------|--------|
| H1 | 64px | 500 |
| H2 | 36px | 500 |
| H3 | 24px | 500 |
| Body | 15px | 400 |
| Nav | 12px | 500 |
| Button | 14px | 500 |

### Shadows
```css
/* Subtle card shadow */
box-shadow: rgba(0, 0, 0, 0.07) 0px 3px 15px;

/* Elevated card */
box-shadow: rgba(0, 0, 0, 0.12) 0px 10px 30px;

/* Primary blue glow */
box-shadow: rgba(44, 100, 227, 0.2) 0px 0px 0px 4px;

/* Purple accent glow */
box-shadow: rgba(215, 212, 255, 0.6) 0px 10px 60px 0px;
```

### Transitions
```css
transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
```

---

## Visual Reference

Full-page screenshot: See `screenshot-truv-homepage.png` (or fetch from Firecrawl)

Screenshot URL (temporary):
https://storage.googleapis.com/firecrawl-scrape-media/screenshot-c0fd628a-3eed-4ecc-ac14-2e6c45c828b3.png
