# Truv HTML Patterns & Best Practices

Reference patterns for building Truv-branded web pages.

---

## Page Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title | Truv</title>

  <!-- Favicon -->
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">

  <!-- Open Graph -->
  <meta property="og:title" content="Page Title | Truv">
  <meta property="og:description" content="Description here">
  <meta property="og:image" content="https://truv.com/og-image.png">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">

  <!-- Styles -->
  <link rel="stylesheet" href="variables.css">
  <link rel="stylesheet" href="typography.css">
  <link rel="stylesheet" href="components.css">
  <link rel="stylesheet" href="utilities.css">
</head>
<body>
  <header class="truv-nav">...</header>
  <main>...</main>
  <footer class="truv-footer">...</footer>
</body>
</html>
```

---

## Navigation

```html
<header class="truv-nav">
  <div class="truv-container truv-flex truv-items-center truv-justify-between">
    <a href="/" class="truv-nav-logo">
      <img src="/logo-truv.svg" alt="Truv" height="24">
    </a>

    <nav>
      <ul class="truv-nav-menu">
        <li><a href="/solutions" class="truv-nav-link">Solutions</a></li>
        <li><a href="/platform" class="truv-nav-link">Platform</a></li>
        <li><a href="/pricing" class="truv-nav-link">Pricing</a></li>
        <li><a href="/docs" class="truv-nav-link">Docs</a></li>
      </ul>
    </nav>

    <div class="truv-flex truv-gap-3">
      <a href="/contact" class="truv-btn truv-btn-secondary">Contact Sales</a>
      <a href="/signup" class="truv-btn truv-btn-primary">Get Started</a>
    </div>
  </div>
</header>
```

---

## Hero Section

```html
<section class="truv-hero">
  <div class="truv-container">
    <div class="truv-hero-content">
      <h1 class="truv-hero-title">
        Unlock the power of open finance.
      </h1>
      <p class="truv-hero-subtitle">
        Truv makes it easy to verify income, employment, assets,
        insurance, and switch direct deposits.
      </p>
      <div class="truv-flex truv-gap-3">
        <a href="/demo" class="truv-btn truv-btn-primary truv-btn-lg">
          Get a Demo
        </a>
        <a href="/docs" class="truv-btn truv-btn-secondary truv-btn-lg">
          View Docs
        </a>
      </div>
    </div>
  </div>
</section>
```

---

## Section with Cards

```html
<section class="truv-section truv-bg-grey">
  <div class="truv-container">
    <div class="truv-text-center truv-mb-8">
      <span class="truv-label">How It Works</span>
      <h2 class="truv-mt-4">Make confident decisions.</h2>
      <p class="truv-lead truv-max-w-md truv-mx-auto">
        The only unified platform purpose-built for organizations.
      </p>
    </div>

    <div class="truv-grid truv-grid-3">
      <div class="truv-card truv-card-elevated">
        <span class="truv-label">Truv Bridge</span>
        <h3 class="truv-mt-4">Industry-leading conversion rates.</h3>
        <p>Delight your users with a seamless user experience.</p>
        <a href="/platform/bridge" class="truv-link-arrow">Learn more</a>
      </div>

      <div class="truv-card truv-card-elevated">
        <span class="truv-label">Dashboard</span>
        <h3 class="truv-mt-4">Enterprise-ready tools.</h3>
        <p>Best-in-class dashboard for developers and operations.</p>
        <a href="/platform/dashboard" class="truv-link-arrow">Learn more</a>
      </div>

      <div class="truv-card truv-card-elevated">
        <span class="truv-label">Integrations</span>
        <h3 class="truv-mt-4">Quick implementation.</h3>
        <p>Integrations with Encompass, nCino and more.</p>
        <a href="/integrations" class="truv-link-arrow">Learn more</a>
      </div>
    </div>
  </div>
</section>
```

---

## Feature Cards (4-up grid)

```html
<section class="truv-section">
  <div class="truv-container">
    <div class="truv-grid truv-grid-4">

      <a href="/solutions/mortgage" class="truv-card truv-card-media truv-hover-lift">
        <img src="/card-mortgage.webp" alt="">
        <div class="truv-card-media-content">
          <h3>Mortgage Lending.</h3>
          <p class="truv-text-muted">Income & Employment. Assets. Home Insurance.</p>
          <span class="truv-link-arrow">Learn more</span>
        </div>
      </a>

      <!-- Repeat for other cards -->

    </div>
  </div>
</section>
```

---

## CTA Section

```html
<section class="truv-section truv-bg-dark truv-text-white truv-text-center">
  <div class="truv-container truv-max-w-md">
    <h2>Ready to get started?</h2>
    <p class="truv-mt-4" style="color: rgba(255,255,255,0.7);">
      Talk to our team to learn how Truv can help your business.
    </p>
    <div class="truv-mt-6">
      <a href="/contact" class="truv-btn truv-btn-white truv-btn-lg">
        Contact Sales
      </a>
    </div>
  </div>
</section>
```

---

## Email Capture Form

```html
<div class="truv-input-group" style="max-width: 480px;">
  <input
    type="email"
    class="truv-input"
    placeholder="Enter your work email"
    required
  >
  <button type="submit" class="truv-btn truv-btn-primary">
    Get Started
  </button>
</div>
```

---

## Footer

```html
<footer class="truv-footer">
  <div class="truv-container">
    <div class="truv-grid truv-grid-4 truv-gap-8">

      <div>
        <img src="/logo-truv-white.svg" alt="Truv" height="24" class="truv-mb-6">
        <p style="color: rgba(255,255,255,0.6);">
          The industry-leading consumer permissioned data platform.
        </p>
      </div>

      <div>
        <h4 class="truv-footer-title">Products</h4>
        <ul class="truv-list-none">
          <li><a href="/products/income">Income Verification</a></li>
          <li><a href="/products/employment">Employment Verification</a></li>
          <li><a href="/products/assets">Assets</a></li>
          <li><a href="/products/dds">Direct Deposit Switch</a></li>
        </ul>
      </div>

      <div>
        <h4 class="truv-footer-title">Solutions</h4>
        <ul class="truv-list-none">
          <li><a href="/solutions/mortgage">Mortgage Lending</a></li>
          <li><a href="/solutions/consumer">Consumer Lending</a></li>
          <li><a href="/solutions/banking">Retail Banking</a></li>
          <li><a href="/solutions/tenant">Tenant Screening</a></li>
        </ul>
      </div>

      <div>
        <h4 class="truv-footer-title">Company</h4>
        <ul class="truv-list-none">
          <li><a href="/about">About</a></li>
          <li><a href="/careers">Careers</a></li>
          <li><a href="/blog">Blog</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </div>

    </div>

    <div class="truv-mt-8 truv-pt-6" style="border-top: 1px solid rgba(255,255,255,0.1);">
      <p style="color: rgba(255,255,255,0.4); font-size: 12px;">
        © 2026 Truv. All rights reserved.
      </p>
    </div>
  </div>
</footer>
```

---

## Best Practices

### Spacing
- Use `truv-section` for major page sections (71px top, 178px bottom)
- Use `truv-container` to constrain content to 1280px max
- Card padding: 28px
- Grid gap: 14px
- Element spacing: multiples of 4px (4, 8, 14, 16, 24, 28, 32...)

### Typography
- Headlines: Gilroy Medium (500 weight)
- Body: Gilroy Medium at 15px
- Labels: Uppercase, 10-12px, semibold, with letter-spacing

### Buttons
- Always pill-shaped (50px radius)
- Primary: Blue background for main CTAs
- Secondary: Outline for secondary actions
- Minimum height: 50px

### Cards
- Border radius: 28px
- Use `truv-card-elevated` for hover lift effect
- Add `truv-hover-lift` for interactive cards

### Images
- Use WebP format when possible
- Provide mobile variants (suffix `-mob.webp`)
- Use `object-fit: cover` for card images

### Colors
- Dark text (#171717) on light backgrounds
- White text on dark/primary backgrounds
- Use muted colors (#A7A7A7) for secondary text
- Primary blue (#2C64E3) for links and CTAs

### Accessibility
- Maintain 4.5:1 contrast ratio minimum
- Use semantic HTML (nav, main, section, article)
- Include alt text for all images
- Support keyboard navigation with visible focus states

### Responsive
- Mobile-first approach
- Breakpoints: 768px (tablet), 1024px (desktop), 1280px (wide)
- Stack grids to single column on mobile
- Reduce section padding on mobile
