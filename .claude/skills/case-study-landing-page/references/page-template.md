# Case Study Landing Page Template

Copy this template and replace the placeholders with customer-specific content.

## Placeholders to Replace

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{CUSTOMER_NAME}}` | Company name | Prosperity Home Mortgage |
| `{{CUSTOMER_SLUG}}` | URL-safe name | prosperity |
| `{{CUSTOMER_LOGO}}` | Logo path | /wp-content/.../prosperity-logo.png |
| `{{PDF_FILENAME}}` | PDF file name | prosperity-home-mortgage-case-study |
| `{{HEADLINE}}` | Hero headline | Slash verification costs 90% |
| `{{HIGHLIGHT}}` | Highlighted text | costs 90% |
| `{{SUBTITLE}}` | Hero subtitle | See how a top 15 mortgage lender... |
| `{{PROOF_TEXT}}` | Social proof | A Berkshire Hathaway Affiliate |
| `{{STAT_1_VALUE}}` | First stat number | 90 |
| `{{STAT_1_SUFFIX}}` | First stat suffix | %+ |
| `{{STAT_1_LABEL}}` | First stat label | Cost savings over legacy providers |
| `{{STAT_2_VALUE}}` | Second stat number | 70 |
| `{{STAT_2_SUFFIX}}` | Second stat suffix | % |
| `{{STAT_2_LABEL}}` | Second stat label | VOIE login conversion rate |
| `{{STAT_3_VALUE}}` | Third stat number | 80 |
| `{{STAT_3_SUFFIX}}` | Third stat suffix | % |
| `{{STAT_3_LABEL}}` | Third stat label | VOA login conversion rate |
| `{{STAT_4_VALUE}}` | Fourth stat number | 1 |
| `{{STAT_4_PREFIX}}` | Fourth stat prefix | < |
| `{{STAT_4_SUFFIX}}` | Fourth stat suffix | mo |
| `{{STAT_4_LABEL}}` | Fourth stat label | Implementation timeline |
| `{{LEARN_1}}` | First learning point | How PHM cut verification costs... |
| `{{LEARN_2}}` | Second learning point | The implementation strategy... |
| `{{LEARN_3}}` | Third learning point | Why borrower conversion rates... |
| `{{LEARN_4}}` | Fourth learning point | How cross-platform portability... |
| `{{QUOTE_TEXT}}` | Customer quote | Truv's platform gave us... |
| `{{QUOTE_HIGHLIGHT}}` | Highlighted part of quote | Conversion rates doubled... |
| `{{QUOTE_INITIALS}}` | Person's initials | JB |
| `{{QUOTE_NAME}}` | Person's name | Josh Byrom |
| `{{QUOTE_TITLE}}` | Person's title | SVP, Technology & Innovation |
| `{{SEO_TITLE}}` | Page title for SEO | How {{CUSTOMER_NAME}} Cut... |
| `{{SEO_DESCRIPTION}}` | Meta description | Download the case study... |

## Template File

Save as `src/pages/lp/{{CUSTOMER_SLUG}}-case-study.astro`

```astro
---
import SeoMeta from "../../components/SeoMeta.astro";
import SiteHeader from "../../components/SiteHeader.astro";
import SiteFooter from "../../components/SiteFooter.astro";
import CookieBanner from "../../components/CookieBanner.astro";
import TrackingHead from "../../components/tracking/TrackingHead.astro";
import TrackingBody from "../../components/tracking/TrackingBody.astro";

export const prerender = true;

const pdfUrl = "/resources/{{PDF_FILENAME}}.pdf";
const pdfCover = "/resources/{{CUSTOMER_SLUG}}-case-study-cover.png";
const customerLogo = "{{CUSTOMER_LOGO}}";
const truvLogo = "/wp-content/themes/twentytwentyone/assets_truv/images/logo/logo-truv.svg";
---

<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <SeoMeta
        title="{{SEO_TITLE}}"
        description="{{SEO_DESCRIPTION}}"
    />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <title>{{CUSTOMER_NAME}} Case Study | Truv</title>
    <TrackingHead pageName="{{CUSTOMER_NAME}} Case Study LP" pageCategory="landing-page" />
    <link rel="stylesheet" href="/wp-styles/main.min.css" />
</head>
<body class="truv-lp">
    <TrackingBody />
    <SiteHeader />

    <main class="truv-lp__main">
        <!-- Hero -->
        <section class="truv-lp__hero">
            <div class="truv-lp__hero-glow"></div>
            <div class="truv-lp__hero-glow truv-lp__hero-glow--alt"></div>

            <!-- Decorative grid pattern -->
            <div class="truv-lp__hero-pattern" aria-hidden="true">
                <svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="grid-fade" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#2C64E3" stop-opacity="0.15"/>
                            <stop offset="100%" stop-color="#2C64E3" stop-opacity="0"/>
                        </linearGradient>
                    </defs>
                    <g stroke="url(#grid-fade)" stroke-width="1">
                        <line x1="0" y1="50" x2="400" y2="50"/>
                        <line x1="0" y1="100" x2="400" y2="100"/>
                        <line x1="0" y1="150" x2="400" y2="150"/>
                        <line x1="0" y1="200" x2="400" y2="200"/>
                        <line x1="0" y1="250" x2="400" y2="250"/>
                        <line x1="0" y1="300" x2="400" y2="300"/>
                        <line x1="0" y1="350" x2="400" y2="350"/>
                        <line x1="50" y1="0" x2="50" y2="400"/>
                        <line x1="100" y1="0" x2="100" y2="400"/>
                        <line x1="150" y1="0" x2="150" y2="400"/>
                        <line x1="200" y1="0" x2="200" y2="400"/>
                        <line x1="250" y1="0" x2="250" y2="400"/>
                        <line x1="300" y1="0" x2="300" y2="400"/>
                        <line x1="350" y1="0" x2="350" y2="400"/>
                    </g>
                    <circle cx="200" cy="200" r="80" stroke="#2C64E3" stroke-opacity="0.2" stroke-width="2" fill="none"/>
                    <circle cx="200" cy="200" r="120" stroke="#2C64E3" stroke-opacity="0.1" stroke-width="1" fill="none"/>
                    <circle cx="200" cy="200" r="160" stroke="#2C64E3" stroke-opacity="0.05" stroke-width="1" fill="none"/>
                </svg>
            </div>

            <div class="truv-container">
                <div class="truv-lp__hero-grid">
                    <div class="truv-lp__hero-content">
                        <div class="truv-lp__hero-meta">
                            <span class="truv-label">Case Study</span>
                        </div>

                        <h1 class="truv-lp__hero-title">
                            {{HEADLINE}}<br>
                            <span class="truv-lp__hero-highlight">{{HIGHLIGHT}}</span>
                        </h1>

                        <p class="truv-lp__hero-subtitle">
                            {{SUBTITLE}}
                        </p>

                        <div class="truv-lp__hero-proof">
                            <img src={customerLogo} alt="{{CUSTOMER_NAME}}" class="truv-lp__hero-logo" />
                            <span class="truv-lp__hero-proof-text">{{PROOF_TEXT}}</span>
                        </div>
                    </div>

                    <div class="truv-lp__hero-form-col">
                        <div class="truv-card truv-card--elevated">
                            <div class="truv-lp__form-header">
                                <h2 class="truv-h3">Get the Full Story</h2>
                                <p class="truv-text-secondary">See how {{CUSTOMER_NAME}} achieved these results.</p>
                                <div class="truv-lp__bonus">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                        <path d="M2 17l10 5 10-5"/>
                                        <path d="M2 12l10 5 10-5"/>
                                    </svg>
                                    <span>Includes implementation checklist</span>
                                </div>
                            </div>

                            <div id="hubspot-form-hero" class="truv-lp__hubspot-form"></div>

                            <p class="truv-lp__trust">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                <span>Your info is secure and never shared</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Stats -->
        <section class="truv-section truv-section--grey">
            <div class="truv-container">
                <p class="truv-lp__stats-header">Results {{CUSTOMER_NAME}} achieved with Truv</p>
                <div class="truv-lp__stats-grid">
                    <div class="truv-lp__stat">
                        <span class="truv-lp__stat-value" data-target="{{STAT_1_VALUE}}" data-suffix="{{STAT_1_SUFFIX}}">0{{STAT_1_SUFFIX}}</span>
                        <span class="truv-lp__stat-label">{{STAT_1_LABEL}}</span>
                    </div>
                    <div class="truv-lp__stat">
                        <span class="truv-lp__stat-value" data-target="{{STAT_2_VALUE}}" data-suffix="{{STAT_2_SUFFIX}}">0{{STAT_2_SUFFIX}}</span>
                        <span class="truv-lp__stat-label">{{STAT_2_LABEL}}</span>
                    </div>
                    <div class="truv-lp__stat">
                        <span class="truv-lp__stat-value" data-target="{{STAT_3_VALUE}}" data-suffix="{{STAT_3_SUFFIX}}">0{{STAT_3_SUFFIX}}</span>
                        <span class="truv-lp__stat-label">{{STAT_3_LABEL}}</span>
                    </div>
                    <div class="truv-lp__stat">
                        <span class="truv-lp__stat-value" data-target="{{STAT_4_VALUE}}" data-prefix="{{STAT_4_PREFIX}}" data-suffix="{{STAT_4_SUFFIX}}">0{{STAT_4_SUFFIX}}</span>
                        <span class="truv-lp__stat-label">{{STAT_4_LABEL}}</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- Preview -->
        <section class="truv-section">
            <div class="truv-container">
                <div class="truv-lp__preview-grid">
                    <div class="truv-lp__preview-visual">
                        <div class="truv-lp__doc">
                            <button class="truv-lp__doc-cover" id="truv-doc-trigger" type="button" aria-label="Download case study PDF">
                                <img src={pdfCover} alt="{{CUSTOMER_NAME}} Case Study Preview" class="truv-lp__doc-cover-img" />
                                <div class="truv-lp__doc-cover-overlay">
                                    <div class="truv-lp__doc-download-badge">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/>
                                            <line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                        <span>Download</span>
                                    </div>
                                </div>
                            </button>
                            <div class="truv-lp__doc-label">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                <span>Fill out the form to download</span>
                            </div>
                        </div>
                    </div>

                    <div class="truv-lp__preview-text">
                        <h2 class="truv-h2">What you'll learn</h2>
                        <ul class="truv-lp__checklist">
                            <li class="truv-lp__checklist-item">
                                <span class="truv-lp__checklist-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </span>
                                <span>{{LEARN_1}}</span>
                            </li>
                            <li class="truv-lp__checklist-item">
                                <span class="truv-lp__checklist-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </span>
                                <span>{{LEARN_2}}</span>
                            </li>
                            <li class="truv-lp__checklist-item">
                                <span class="truv-lp__checklist-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </span>
                                <span>{{LEARN_3}}</span>
                            </li>
                            <li class="truv-lp__checklist-item">
                                <span class="truv-lp__checklist-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </span>
                                <span>{{LEARN_4}}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        <!-- Quote -->
        <section class="truv-section truv-section--quote">
            <div class="truv-container truv-container--narrow">
                <div class="truv-lp__quote-card">
                    <div class="truv-lp__quote-accent"></div>
                    <figure class="truv-lp__quote">
                        <div class="truv-lp__quote-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.192 15.757c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.1-1.956.76-3.022.66-1.065 1.515-1.867 2.558-2.403L9.373 5c-.8.396-1.56.898-2.26 1.505-.71.607-1.34 1.305-1.9 2.094s-.98 1.68-1.25 2.69-.346 2.04-.217 3.1c.168 1.4.62 2.52 1.356 3.35.735.84 1.652 1.26 2.748 1.26.965 0 1.766-.29 2.4-.878.628-.576.94-1.365.94-2.368l.002.003zm9.124 0c0-.88-.23-1.618-.69-2.217-.326-.42-.77-.692-1.327-.817-.56-.124-1.074-.13-1.54-.022-.16-.94.09-1.95.75-3.02.66-1.06 1.514-1.86 2.557-2.4L18.49 5c-.8.396-1.555.898-2.26 1.505-.708.607-1.34 1.305-1.894 2.094-.556.79-.97 1.68-1.24 2.69-.273 1-.345 2.04-.217 3.1.165 1.4.615 2.52 1.35 3.35.732.833 1.646 1.25 2.742 1.25.967 0 1.768-.29 2.402-.876.627-.576.942-1.365.942-2.368v.01z"/>
                            </svg>
                        </div>
                        <blockquote class="truv-lp__quote-text">
                            {{QUOTE_TEXT}} <strong>{{QUOTE_HIGHLIGHT}}</strong>
                        </blockquote>
                        <figcaption class="truv-lp__quote-cite">
                            <div class="truv-lp__quote-avatar">{{QUOTE_INITIALS}}</div>
                            <div class="truv-lp__quote-author">
                                <strong class="truv-lp__quote-name">{{QUOTE_NAME}}</strong>
                                <span class="truv-lp__quote-role">{{QUOTE_TITLE}}</span>
                                <span class="truv-lp__quote-company">{{CUSTOMER_NAME}}</span>
                            </div>
                        </figcaption>
                    </figure>
                </div>
            </div>
        </section>

        <!-- CTA -->
        <section class="truv-section truv-section--dark">
            <div class="truv-container">
                <div class="truv-lp__cta">
                    <div class="truv-lp__cta-content">
                        <h2 class="truv-h2 truv-text-white">Ready to see the full story?</h2>
                        <p class="truv-lp__cta-desc">Download the complete case study and learn how {{CUSTOMER_NAME}} transformed their verification process.</p>
                    </div>
                    <button class="truv-btn truv-btn--white" id="truv-cta-trigger">
                        <span>Get the Full Story</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                </div>
            </div>
        </section>
    </main>

    <!-- Modal -->
    <div class="truv-modal" id="truv-modal" aria-hidden="true" role="dialog">
        <div class="truv-modal__backdrop" id="truv-modal-backdrop"></div>
        <div class="truv-modal__panel">
            <button class="truv-modal__close" id="truv-modal-close" aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>

            <div class="truv-modal__body">
                <h2 class="truv-h3">Get the Full Story</h2>
                <p class="truv-text-secondary truv-mb-24">Enter your details to download the full case study.</p>
                <div class="truv-lp__bonus truv-lp__bonus--center truv-mb-24">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                    </svg>
                    <span>Includes implementation checklist</span>
                </div>

                <div id="hubspot-form-modal" class="truv-lp__hubspot-form"></div>

                <p class="truv-lp__trust">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span>Your info is secure and never shared</span>
                </p>
            </div>
        </div>
    </div>

    <CookieBanner />
    <SiteFooter />

    <!-- Include the full CSS from the Prosperity page (copy from src/pages/lp/prosperity-case-study.astro) -->
    <style is:global>
        /* Copy the complete CSS block from prosperity-case-study.astro */
        /* The CSS is ~1400 lines and includes all brand styling */
    </style>

    <!-- HubSpot Form Script -->
    <script charset="utf-8" type="text/javascript" src="//js.hsforms.net/forms/embed/v2.js"></script>

    <script define:vars={{ pdfUrl }}>
        // Modal functionality
        const modal = document.getElementById('truv-modal');
        const ctaTrigger = document.getElementById('truv-cta-trigger');
        const docTrigger = document.getElementById('truv-doc-trigger');
        const modalClose = document.getElementById('truv-modal-close');
        const modalBackdrop = document.getElementById('truv-modal-backdrop');

        function openModal() {
            modal?.classList.add('is-open');
            document.body.style.overflow = 'hidden';
        }

        function closeModal() {
            modal?.classList.remove('is-open');
            document.body.style.overflow = '';
        }

        ctaTrigger?.addEventListener('click', openModal);
        docTrigger?.addEventListener('click', openModal);
        modalClose?.addEventListener('click', closeModal);
        modalBackdrop?.addEventListener('click', closeModal);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal?.classList.contains('is-open')) {
                closeModal();
            }
        });

        // Animated counter for stats
        function animateCounter(element) {
            const target = parseInt(element.dataset.target, 10);
            const prefix = element.dataset.prefix || '';
            const suffix = element.dataset.suffix || '';
            const duration = 1500;
            const startTime = performance.now();

            element.classList.add('is-animating');

            function updateCounter(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(easeOut * target);

                element.textContent = prefix + current + suffix;

                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                } else {
                    element.classList.remove('is-animating');
                }
            }

            requestAnimationFrame(updateCounter);
        }

        // Intersection Observer for stats animation
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const statValues = entry.target.querySelectorAll('[data-target]');
                    statValues.forEach((stat, index) => {
                        setTimeout(() => animateCounter(stat), index * 150);
                    });
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        document.addEventListener('DOMContentLoaded', () => {
            const statsGrid = document.querySelector('.truv-lp__stats-grid');
            if (statsGrid) {
                statsObserver.observe(statsGrid);
            }
        });

        // Initialize HubSpot forms
        document.addEventListener('DOMContentLoaded', () => {
            function downloadPDF() {
                const link = document.createElement('a');
                link.href = pdfUrl;
                link.download = pdfUrl.split('/').pop();
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            // Hero form
            if (window.hbspt && document.getElementById('hubspot-form-hero')) {
                hbspt.forms.create({
                    portalId: "19933594",
                    formId: "3e13cb92-4a61-469a-bece-7c9fdc2dd710",
                    region: "na1",
                    target: "#hubspot-form-hero",
                    submitText: "Get the Full Story",
                    onFormSubmitted: function() {
                        downloadPDF();
                    }
                });
            }

            // Modal form
            if (window.hbspt && document.getElementById('hubspot-form-modal')) {
                hbspt.forms.create({
                    portalId: "19933594",
                    formId: "3e13cb92-4a61-469a-bece-7c9fdc2dd710",
                    region: "na1",
                    target: "#hubspot-form-modal",
                    submitText: "Get the Full Story",
                    onFormSubmitted: function() {
                        closeModal();
                        downloadPDF();
                    }
                });
            }
        });
    </script>
</body>
</html>
```

## CSS Reference

The complete CSS (~1400 lines) should be copied from `src/pages/lp/prosperity-case-study.astro`. It includes:

- Design tokens (brand colors, typography, shadows)
- Hero section styling
- Card and form styling
- Stats section with animated counters
- PDF preview with download badge
- Quote section styling
- CTA section
- Modal styling
- HubSpot form overrides
- Responsive breakpoints (1024px, 768px)
