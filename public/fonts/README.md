# Truv Fonts

This folder contains the official Truv brand typeface files.

## Gilroy

Gilroy is a modern geometric sans-serif typeface. Truv uses two weights:

| File | Weight | Usage |
|------|--------|-------|
| `Gilroy-Medium.woff2` | Medium (500) | Body text, paragraphs, UI elements |
| `Gilroy-Medium.woff` | Medium (500) | Legacy browser support |
| `Gilroy-SemiBold.woff2` | SemiBold (600) | Headings, buttons, emphasis |
| `Gilroy-SemiBold.woff` | SemiBold (600) | Legacy browser support |

## Web Usage

### CSS @font-face

```css
@font-face {
  font-family: 'Gilroy';
  src: url('fonts/Gilroy-Medium.woff2') format('woff2'),
       url('fonts/Gilroy-Medium.woff') format('woff');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Gilroy';
  src: url('fonts/Gilroy-SemiBold.woff2') format('woff2'),
       url('fonts/Gilroy-SemiBold.woff') format('woff');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
```

### Font Stack

```css
font-family: "Gilroy", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

## Licensing

Gilroy is a commercial typeface. Ensure you have the appropriate license for your use case:

- **Web:** Web font license required
- **Desktop:** Desktop license for design applications
- **App:** App embedding license for mobile/desktop applications

Contact your team lead or legal for license documentation.
