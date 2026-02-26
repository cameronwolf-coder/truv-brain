#!/usr/bin/env python3
"""Generate Meta carousel ad cards for all case studies.
Each case study gets 5 cards with different ad copy angles,
all sharing the same spiral-bound document mockup visual."""

import os
import subprocess

BASE = "/Users/cameronwolf/Downloads/Projects/truv-brain/docs/meta-ads"
BRANDING = "/Users/cameronwolf/Downloads/Projects/truv-brain/branding"

CASE_STUDIES = {
    "crosscountry-mortgage": {
        "company": "CrossCountry Mortgage",
        "partner_logo": "ccm-logo.svg",
        "partner_badge_bg": "linear-gradient(43deg, rgb(0, 174, 217) 15%, rgb(6, 67, 104) 89%)",
        "cards": [
            {
                "type": "metric",
                "metric_blue": "$10M",
                "metric_white": "Saved",
                "subline": "CrossCountry Mortgage cut verification costs with consumer-permissioned data from Truv.",
            },
            {
                "type": "quote",
                "quote": "Truv has redefined what partnership means\u200a\u2014\u200adelivering accurate, trustworthy data, rapid implementation, and the agility to help us close loans faster.",
                "attribution": "Tom Durney",
                "title": "EVP of Corporate Operations Support",
            },
            {
                "type": "challenge",
                "before_label": "Before",
                "before_value": "$18M/yr",
                "before_desc": "on legacy verification",
                "after_label": "With Truv",
                "after_value": "$10M",
                "after_desc": "estimated annual savings",
                "subline": "From bottleneck to breakthrough.",
            },
            {
                "type": "stats",
                "stats": [
                    ("70%+", "Post-Login\nCompletion"),
                    ("8%", "R&W Relief\nUplift"),
                    ("<1 mo", "Company-Wide\nGo-Live"),
                ],
                "subline": "Real results from the #1 retail lender in the U.S.",
            },
            {
                "type": "cta",
                "headline": "See How CCM Saved $10M on Verification",
                "cta_text": "Download the Case Study",
            },
        ],
    },
    "first-continental-mortgage": {
        "company": "First Continental Mortgage",
        "partner_logo": "fcm-logo.png",
        "partner_badge_bg": "linear-gradient(43deg, #1a3a5c 15%, #0d2440 89%)",
        "cards": [
            {
                "type": "metric",
                "metric_blue": "$745K",
                "metric_white": "Saved",
                "subline": "First Continental Mortgage slashed verification spend across 12 JV partnerships with Truv.",
            },
            {
                "type": "quote",
                "quote": "Our processors love that we can get ahold of someone at Truv within 4 hours. Compare that to other vendors, where our team couldn\u2019t reach a human for 2 years.",
                "attribution": "Jessica Kipnis",
                "title": "Chief Operating Officer",
            },
            {
                "type": "challenge",
                "before_label": "Before",
                "before_value": "$2M/yr",
                "before_desc": "on legacy VOIE vendor",
                "after_label": "With Truv",
                "after_value": "$745K",
                "after_desc": "estimated annual savings",
                "subline": "Builder-focused lending, reimagined.",
            },
            {
                "type": "stats",
                "stats": [
                    ("64%", "VOIE Login\nConversion"),
                    ("85%", "VOA Login\nConversion"),
                    ("8.21%", "R&W Relief\nUplift"),
                ],
                "subline": "Across 7,000 loans per year in new construction lending.",
            },
            {
                "type": "cta",
                "headline": "See How FCM Saved $745K on Verification",
                "cta_text": "Download the Case Study",
            },
        ],
    },
    "prosperity-home-mortgage": {
        "company": "Prosperity Home Mortgage",
        "partner_logo": "phm-logo.png",
        "partner_badge_bg": "linear-gradient(43deg, #2d5a3d 15%, #1a3528 89%)",
        "cards": [
            {
                "type": "metric",
                "metric_blue": "90%",
                "metric_white": "Savings",
                "subline": "Prosperity Home Mortgage cut verification costs by 90% over legacy providers with Truv.",
            },
            {
                "type": "quote",
                "quote": "Truv\u2019s platform gave us the transparency, trust, and borrower experience we were missing. Conversion rates doubled seemingly overnight.",
                "attribution": "Josh Byrom",
                "title": "SVP, Technology & Innovation",
            },
            {
                "type": "challenge",
                "before_label": "Before",
                "before_value": "$123",
                "before_desc": "per borrower per verification",
                "after_label": "With Truv",
                "after_value": "90%+",
                "after_desc": "cost savings over legacy",
                "subline": "From $492 per closed loan to a fraction of the cost.",
            },
            {
                "type": "stats",
                "stats": [
                    ("70%", "VOIE Login\nConversion"),
                    ("80%", "VOA Login\nConversion"),
                    ("<1 mo", "Implementation\nin Lodasoft"),
                ],
                "subline": "A top-15 lender serving 25,000+ borrowers annually.",
            },
            {
                "type": "cta",
                "headline": "See How Prosperity Cut Verification Costs by 90%",
                "cta_text": "Download the Case Study",
            },
        ],
    },
}


# ===================== SHARED CSS =====================

def shared_css(partner_badge_bg):
    return f"""
  @font-face {{
    font-family: 'Gilroy';
    src: url('../../branding/fonts/Gilroy-Medium.woff2') format('woff2');
    font-weight: 500; font-style: normal; font-display: swap;
  }}
  @font-face {{
    font-family: 'Gilroy';
    src: url('../../branding/fonts/Gilroy-SemiBold.woff2') format('woff2');
    font-weight: 600; font-style: normal; font-display: swap;
  }}

  * {{ margin: 0; padding: 0; box-sizing: border-box; }}

  body {{
    width: 1080px; height: 1080px; overflow: hidden; margin: 0;
    font-family: 'Gilroy', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #050A18; position: relative;
  }}

  .bg-ellipse-1 {{
    position: absolute; top: 300px; left: 250px;
    width: 1200px; height: 1200px; pointer-events: none; opacity: 0.5;
  }}
  .bg-ellipse-1 img {{ width: 100%; height: 100%; object-fit: contain; }}

  .bg-ellipse-2 {{
    position: absolute; top: -450px; left: -450px;
    width: 1050px; height: 950px; pointer-events: none; opacity: 0.7;
  }}
  .bg-ellipse-2 img {{ width: 100%; height: 100%; object-fit: contain; }}

  .logo {{ width: 100px; height: 36px; }}
  .logo img {{ width: 100%; height: 100%; }}

  .tag {{
    font-weight: 600; font-size: 12px;
    letter-spacing: 2.4px; text-transform: uppercase;
    color: rgba(255,255,255,0.35);
  }}

  /* ===== SPIRAL-BOUND DOCUMENT ===== */
  .doc-mockup {{
    position: absolute; bottom: -50px; left: 50%;
    transform: translateX(-46%);
    width: 540px; height: 540px;
    z-index: 3; perspective: 1400px;
  }}
  .doc-3d {{
    width: 100%; height: 100%;
    transform: rotateY(-12deg) rotateX(8deg) rotateZ(2deg);
    transform-style: preserve-3d; position: relative;
  }}
  .page-stack {{
    position: absolute; top: 8px; left: 8px;
    width: 400px; height: 510px;
    background: #e8e8e6; border-radius: 4px;
    box-shadow: 2px 4px 20px rgba(0,0,0,0.3);
  }}
  .page-stack-2 {{
    position: absolute; top: 5px; left: 5px;
    width: 400px; height: 510px;
    background: #ededeb; border-radius: 4px;
  }}
  .page-stack-3 {{
    position: absolute; top: 2px; left: 2px;
    width: 400px; height: 510px;
    background: #f3f3f1; border-radius: 4px;
  }}
  .preview-page {{
    position: absolute; top: 0; left: 14px;
    width: 400px; height: 510px;
    border-radius: 4px; overflow: hidden;
    box-shadow: 3px 6px 24px rgba(0,0,0,0.2); z-index: 1;
  }}
  .preview-page img {{
    width: 100%; height: 100%; object-fit: cover;
    object-position: top center; display: block;
    filter: blur(0.4px); opacity: 0.85;
  }}
  .cover-page {{
    position: absolute; top: 0; left: 0;
    width: 400px; height: 510px;
    border-radius: 4px; overflow: hidden;
    box-shadow: 0 30px 60px rgba(0,0,0,0.45), 0 10px 20px rgba(0,0,0,0.3),
      0 0 0 1px rgba(255,255,255,0.05);
    z-index: 2;
  }}
  .cover-page img {{
    width: 100%; height: 100%; object-fit: cover;
    object-position: top center; display: block;
  }}
  .cover-page::after {{
    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(125deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.04) 100%);
    pointer-events: none;
  }}
  .spiral-binding {{
    position: absolute; top: -13px; left: 22px;
    width: 356px; height: 26px;
    display: flex; justify-content: space-between;
    z-index: 10; padding: 0 8px;
  }}
  .ring {{
    width: 16px; height: 26px; position: relative;
  }}
  .ring::before {{
    content: ''; position: absolute; top: 0; left: 50%;
    transform: translateX(-50%);
    width: 14px; height: 26px;
    border: 2.5px solid #a8a8a8; border-radius: 7px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.25);
  }}
  .ring::after {{
    content: ''; position: absolute; top: 3px; left: 50%;
    transform: translateX(-50%);
    width: 6px; height: 20px;
    border: 1.5px solid rgba(190,190,190,0.35); border-radius: 4px;
  }}

  .partner-badge {{
    position: absolute; right: 68px; bottom: 200px;
    width: 100px; height: 102px; border-radius: 30px;
    background: {partner_badge_bg};
    box-shadow: 0 12px 24px rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
    z-index: 8; padding: 14px;
  }}
  .partner-badge img {{
    width: 100%; height: 100%; object-fit: contain;
    filter: brightness(0) invert(1);
  }}

  .cta-btn {{
    position: absolute; bottom: 38px; left: 50%;
    transform: translateX(-50%);
    display: inline-flex; align-items: center; justify-content: center;
    background: #2C64E3; color: #FFFFFF;
    font-family: 'Gilroy', sans-serif;
    font-weight: 600; font-size: 18px; letter-spacing: 0.2px;
    padding: 16px 36px; border-radius: 44px;
    text-decoration: none; z-index: 10;
    box-shadow: 0 8px 28px rgba(44,100,227,0.45);
    white-space: nowrap;
  }}
"""


def doc_mockup_html():
    rings = '<div class="ring"></div>' * 14
    return f"""
  <div class="doc-mockup">
    <div class="doc-3d">
      <div class="page-stack"></div>
      <div class="page-stack-2"></div>
      <div class="page-stack-3"></div>
      <div class="preview-page"><img src="pdf-pages/page-5.png" alt="Preview"></div>
      <div class="cover-page"><img src="pdf-pages/page-1.png" alt="Cover"></div>
      <div class="spiral-binding">{rings}</div>
    </div>
  </div>"""


def bg_html():
    return """
  <div class="bg-ellipse-1"><img src="assets/ellipse-glow-1.svg" alt=""></div>
  <div class="bg-ellipse-2"><img src="assets/ellipse-glow-2.svg" alt=""></div>"""


# ===================== CARD TYPES =====================

def metric_card(config, card):
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080">
<title>{config['company']} - Metric</title>
<style>{shared_css(config['partner_badge_bg'])}
  .top-content {{
    position: absolute; top: 0; left: 0; width: 1080px;
    display: flex; flex-direction: column; align-items: center;
    padding-top: 52px; gap: 16px; z-index: 5;
  }}
  .metric {{
    font-weight: 600; font-size: 96px; line-height: 1;
    letter-spacing: -3px; text-align: center; color: #FFFFFF;
  }}
  .metric span {{ color: #2C64E3; }}
  .subline {{
    font-weight: 500; font-size: 21px; line-height: 29px;
    text-align: center; color: rgba(255,255,255,0.5); width: 500px;
  }}
</style></head>
<body>{bg_html()}
  <div class="top-content">
    <div class="logo"><img src="assets/truv-logo.svg" alt="truv"></div>
    <div class="tag">Customer Story</div>
    <div class="metric"><span>{card['metric_blue']}</span> {card['metric_white']}</div>
    <div class="subline">{card['subline']}</div>
  </div>
  {doc_mockup_html()}
  <div class="partner-badge"><img src="assets/{config['partner_logo']}" alt="{config['company']}"></div>
  <a href="#" class="cta-btn">Read the Case Study</a>
</body></html>"""


def quote_card(config, card):
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080">
<title>{config['company']} - Quote</title>
<style>{shared_css(config['partner_badge_bg'])}
  .top-content {{
    position: absolute; top: 0; left: 0; width: 1080px;
    display: flex; flex-direction: column; align-items: center;
    padding-top: 52px; gap: 20px; z-index: 5;
  }}
  .quote-mark {{
    font-size: 72px; line-height: 1; color: #2C64E3; font-weight: 600;
  }}
  .quote {{
    font-weight: 500; font-size: 26px; line-height: 36px;
    text-align: center; color: rgba(255,255,255,0.85);
    width: 780px; font-style: italic;
  }}
  .attribution {{
    display: flex; flex-direction: column; align-items: center; gap: 2px;
  }}
  .attr-name {{
    font-weight: 600; font-size: 16px; color: rgba(255,255,255,0.6);
  }}
  .attr-title {{
    font-weight: 500; font-size: 14px; color: rgba(255,255,255,0.35);
  }}
</style></head>
<body>{bg_html()}
  <div class="top-content">
    <div class="logo"><img src="assets/truv-logo.svg" alt="truv"></div>
    <div class="tag">Customer Story</div>
    <div class="quote-mark">\u201C</div>
    <div class="quote">{card['quote']}</div>
    <div class="attribution">
      <div class="attr-name">{card['attribution']}</div>
      <div class="attr-title">{card['title']}, {config['company']}</div>
    </div>
  </div>
  {doc_mockup_html()}
  <div class="partner-badge"><img src="assets/{config['partner_logo']}" alt="{config['company']}"></div>
  <a href="#" class="cta-btn">Read the Case Study</a>
</body></html>"""


def challenge_card(config, card):
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080">
<title>{config['company']} - Challenge</title>
<style>{shared_css(config['partner_badge_bg'])}
  .top-content {{
    position: absolute; top: 0; left: 0; width: 1080px;
    display: flex; flex-direction: column; align-items: center;
    padding-top: 52px; gap: 18px; z-index: 5;
  }}
  .comparison {{
    display: flex; align-items: center; gap: 28px;
    margin-top: 8px;
  }}
  .comp-box {{
    display: flex; flex-direction: column; align-items: center;
    gap: 6px; width: 260px;
  }}
  .comp-label {{
    font-weight: 600; font-size: 12px; letter-spacing: 2px;
    text-transform: uppercase;
  }}
  .comp-label.before {{ color: rgba(255,255,255,0.35); }}
  .comp-label.after {{ color: #2C64E3; }}
  .comp-value {{
    font-weight: 600; font-size: 64px; line-height: 1;
    letter-spacing: -2px; color: #FFFFFF;
  }}
  .comp-value.blue {{ color: #2C64E3; }}
  .comp-desc {{
    font-weight: 500; font-size: 15px; color: rgba(255,255,255,0.4);
    text-align: center;
  }}
  .arrow {{
    font-size: 36px; color: rgba(255,255,255,0.2); margin-top: 20px;
  }}
  .subline {{
    font-weight: 500; font-size: 20px; line-height: 28px;
    text-align: center; color: rgba(255,255,255,0.45); width: 460px;
  }}
</style></head>
<body>{bg_html()}
  <div class="top-content">
    <div class="logo"><img src="assets/truv-logo.svg" alt="truv"></div>
    <div class="tag">Customer Story</div>
    <div class="comparison">
      <div class="comp-box">
        <div class="comp-label before">{card['before_label']}</div>
        <div class="comp-value">{card['before_value']}</div>
        <div class="comp-desc">{card['before_desc']}</div>
      </div>
      <div class="arrow">\u2192</div>
      <div class="comp-box">
        <div class="comp-label after">{card['after_label']}</div>
        <div class="comp-value blue">{card['after_value']}</div>
        <div class="comp-desc">{card['after_desc']}</div>
      </div>
    </div>
    <div class="subline">{card['subline']}</div>
  </div>
  {doc_mockup_html()}
  <div class="partner-badge"><img src="assets/{config['partner_logo']}" alt="{config['company']}"></div>
  <a href="#" class="cta-btn">Read the Case Study</a>
</body></html>"""


def stats_card(config, card):
    stats_html = ""
    for value, label in card["stats"]:
        label_html = label.replace("\n", "<br>")
        stats_html += f"""
      <div class="stat-item">
        <div class="stat-value">{value}</div>
        <div class="stat-label">{label_html}</div>
      </div>"""

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080">
<title>{config['company']} - Stats</title>
<style>{shared_css(config['partner_badge_bg'])}
  .top-content {{
    position: absolute; top: 0; left: 0; width: 1080px;
    display: flex; flex-direction: column; align-items: center;
    padding-top: 52px; gap: 18px; z-index: 5;
  }}
  .stats-row {{
    display: flex; align-items: flex-start; gap: 40px;
    margin-top: 10px;
  }}
  .stat-item {{
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    width: 200px;
  }}
  .stat-value {{
    font-weight: 600; font-size: 56px; line-height: 1;
    letter-spacing: -2px; color: #2C64E3;
  }}
  .stat-label {{
    font-weight: 500; font-size: 14px; line-height: 18px;
    color: rgba(255,255,255,0.4); text-align: center;
    text-transform: uppercase; letter-spacing: 1px;
  }}
  .subline {{
    font-weight: 500; font-size: 20px; line-height: 28px;
    text-align: center; color: rgba(255,255,255,0.45); width: 520px;
  }}
</style></head>
<body>{bg_html()}
  <div class="top-content">
    <div class="logo"><img src="assets/truv-logo.svg" alt="truv"></div>
    <div class="tag">Customer Story</div>
    <div class="stats-row">{stats_html}
    </div>
    <div class="subline">{card['subline']}</div>
  </div>
  {doc_mockup_html()}
  <div class="partner-badge"><img src="assets/{config['partner_logo']}" alt="{config['company']}"></div>
  <a href="#" class="cta-btn">Read the Case Study</a>
</body></html>"""


def cta_card(config, card):
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080">
<title>{config['company']} - CTA</title>
<style>{shared_css(config['partner_badge_bg'])}
  .top-content {{
    position: absolute; top: 0; left: 0; width: 1080px;
    display: flex; flex-direction: column; align-items: center;
    padding-top: 52px; gap: 20px; z-index: 5;
  }}
  .headline {{
    font-weight: 500; font-size: 46px; line-height: 52px;
    letter-spacing: -1.4px; text-align: center; width: 740px;
    background-image: linear-gradient(-88.96deg, rgb(44, 100, 227) 2.32%, rgb(255, 255, 255) 82.73%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
  }}
  /* Bigger CTA for last card */
  .cta-btn {{
    font-size: 22px; padding: 20px 48px;
    box-shadow: 0 12px 36px rgba(44,100,227,0.5);
  }}
</style></head>
<body>{bg_html()}
  <div class="top-content">
    <div class="logo"><img src="assets/truv-logo.svg" alt="truv"></div>
    <div class="tag">Customer Story</div>
    <div class="headline">{card['headline']}</div>
  </div>
  {doc_mockup_html()}
  <div class="partner-badge"><img src="assets/{config['partner_logo']}" alt="{config['company']}"></div>
  <a href="#" class="cta-btn">{card['cta_text']}</a>
</body></html>"""


CARD_BUILDERS = {
    "metric": metric_card,
    "quote": quote_card,
    "challenge": challenge_card,
    "stats": stats_card,
    "cta": cta_card,
}


def copy_assets(slug):
    """Copy shared branding assets from linkedin-ads dir."""
    meta_assets = os.path.join(BASE, slug, "assets")
    linkedin_assets = os.path.join(BASE.replace("meta-ads", "linkedin-ads"), slug, "assets")
    os.makedirs(meta_assets, exist_ok=True)

    for asset in ["ellipse-glow-1.svg", "ellipse-glow-2.svg", "truv-logo.svg", "truv-badge.svg"]:
        src = os.path.join(linkedin_assets, asset)
        if os.path.exists(src):
            subprocess.run(["cp", src, meta_assets], check=True)

    partner_logo = CASE_STUDIES[slug]["partner_logo"]
    src = os.path.join(linkedin_assets, partner_logo)
    if os.path.exists(src):
        subprocess.run(["cp", src, meta_assets], check=True)


def main():
    for slug, config in CASE_STUDIES.items():
        out_dir = os.path.join(BASE, slug)
        os.makedirs(out_dir, exist_ok=True)

        copy_assets(slug)

        for i, card in enumerate(config["cards"], 1):
            builder = CARD_BUILDERS[card["type"]]
            html = builder(config, card)
            path = os.path.join(out_dir, f"card-{i}.html")
            with open(path, "w") as f:
                f.write(html)

        print(f"Generated {len(config['cards'])} cards for {slug}")

    print("\nDone! Export PNGs with Chrome headless.")


if __name__ == "__main__":
    main()
