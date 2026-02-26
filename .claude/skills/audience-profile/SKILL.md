---
name: audience-profile
description: This skill should be used when building, updating, or applying audience profiles for Cameron's content. It applies when planning content, writing for a specific audience segment, creating short-form derivatives from long-form pieces, or refining who Cameron is writing for. Triggers on "audience", "who am I writing for", "persona", "reader profile", "content for", "atomize", or "repurpose".
---

# Audience Profile Builder

Build and maintain detailed audience profiles that inform all content decisions, from long-form Substack essays to short-form social posts.

## Why This Exists

Writing for "my audience" with zero specifics produces generic content. This skill builds profiles grounded in real data: who reads Cameron's work, what keeps them subscribed, what makes them share, and what makes them leave.

## When to Use

- Before writing any new content (long-form or short-form)
- When planning a content atomization strategy (1 long-form into multiple short-form pieces)
- When evaluating whether a topic will land with the audience
- When refining targeting for a specific platform (Substack vs. X vs. LinkedIn)
- When onboarding new data (testimonials, DMs, survey responses, comments)

## Content Atomization Context

Cameron's content engine works on a simple model:

1. **One long-form piece** (Substack essay, blog post)
2. **Multiple short-form derivatives** designed to pull readers into the long-form

Each derivative targets a specific audience segment or platform behavior. The audience profile determines which angles to atomize and which platform to prioritize.

## Building a Profile from Scratch

### Step 1: Self-Reflection Inputs

Before generating any profile, collect answers to these questions:

- B2B, B2C, or both?
- What role, job title, or identity describes the reader?
- What industry, company size, or life context?
- What specific value does Cameron's content deliver to them?
- What challenges do they face that this content addresses?
- What existing content has performed best (and with whom)?

### Step 2: Foundation Prompt

Run this prompt, replacing bracketed sections with real answers from Step 1:

```
Create a detailed audience persona for Cameron Wolf's content.

Context: Cameron writes about [topics] for [audience type]. His readers are [role/identity] working in [context] who are responsible for [goals/decisions]. They are trying to accomplish [specific outcome] but face challenges with [specific problems].

For this persona, answer:
- Hopes and goals in subscribing to Cameron's content
- Fears and concerns that keep them reading
- Emotional triggers that make them share or upgrade
- How they judge content quality (what earns trust vs. feels like noise)
- How they discovered Cameron's content
- What keeps them subscribed vs. what triggers unsubscribe
- Internal dialogue when they see a new post in their inbox
```

### Step 3: Deepen the Profile

Follow up with this expansion prompt:

```
Expand this persona with:
- "Day in the life" moments when Cameron's topics become urgent or relevant
- Why they value THIS specific writer over other options in the space
- Prior experiences and biases they bring to the content
- Decision blockers (time, trust, information overload)
- Before/after transformation: what changes after reading consistently
- What differentiates Cameron's content from competitors in their feed
```

### Step 4: Platform-Specific Behavior

For each platform Cameron publishes on, add:

```
For [platform: Substack / X / LinkedIn], describe:
- How this persona uses the platform (scroll vs. search vs. notification)
- Content format preferences (thread vs. single post, long vs. short)
- What makes them stop scrolling
- What makes them click through to the full piece
- What makes them share or reply
- Time of day and context when they engage
```

## Building a Profile from Real Data

Follow Steps 1-4 above, then layer in real subscriber data:

### Data Sources to Gather

- Testimonials and "why I subscribed" messages
- DMs and replies that reveal what resonated
- Survey responses (open-ended questions about value and frustrations)
- Comment threads showing engagement patterns
- Unsubscribe feedback or drop-off patterns
- Top-performing posts by engagement, shares, and conversions

### Data Integration Prompt

```
Here is real data from Cameron's audience: [paste data]

Cross-reference this against the existing persona. Update the profile to reflect:
- Patterns in the language readers actually use
- Conversion triggers confirmed by real behavior
- Content preferences validated by engagement data
- Gaps between assumed audience and actual audience
- New segments or sub-personas emerging from the data
```

### Compression

If the resulting profile exceeds 3,000 words, compress to a reusable reference by keeping:
- Core demographics and psychographics (1 paragraph per persona)
- Top 5 conversion triggers with supporting quotes
- Platform-specific behavior summary (bullet points)
- Language patterns and vocabulary the audience uses
- Content preferences ranked by engagement data

## Applying Profiles to Content

### Long-Form Planning

Before writing a long-form piece, reference the profile to answer:
- Which persona segment does this topic serve?
- What is the "day in the life" moment that makes this urgent?
- What transformation does this piece contribute to?
- What language and framing will resonate (pull from audience vocabulary)?

### Short-Form Atomization

When breaking a long-form piece into short-form derivatives:
- Identify 3-5 angles from the piece that map to different persona segments
- For each angle, determine which platform behavior it fits (stop-scrolling hook, click-through teaser, share-worthy insight)
- Match the format to the platform (X: punchy observation or thread; LinkedIn: professional insight with personal stake; Substack Notes: conversation starter)
- Each short-form piece should create a specific pull toward the long-form

### Content Calendar Application

When planning content over time:
- Rotate across persona segments to avoid writing only for one group
- Track which segments are underserved
- Use audience language in headlines and hooks, not marketing-speak

## References

- `references/cameron-background.md` - Cameron's professional background, expertise, platforms, and voice summary. Load when building or updating profiles to ensure alignment with Cameron's actual content strategy and writing style.
- Voice Profile: `/Users/cameronwolf/Downloads/Projects/Cameron's Brain/docs/plans/2025-12-31-voice-profile-design.md` - Full voice profile with system prompt, anti-drift checklist, and vocabulary signatures
- Writing Checklist: `/Users/cameronwolf/Downloads/Projects/Cameron's Brain/docs/writing-checklist.md` - Pre-commit quality check for all written content

## Output Format

Store completed audience profiles as markdown files. Recommended structure:

```markdown
# Audience Profile: [Segment Name]
Updated: [date]

## Demographics & Psychographics
[1-2 paragraphs]

## Day in the Life
[When Cameron's content becomes relevant]

## Conversion Triggers
[What makes them subscribe, share, upgrade]

## Content Preferences
[Format, length, tone, platform behavior]

## Language Patterns
[Words and phrases they actually use]

## What Earns Trust / What Feels Like Noise
[Quality signals vs. unsubscribe triggers]

## Platform Behavior
### Substack
### X
### LinkedIn
```
