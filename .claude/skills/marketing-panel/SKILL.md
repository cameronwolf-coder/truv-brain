---
name: marketing-panel
description: Assemble a panel of 10 world-class marketing experts to review creative work including ad copy, landing pages, web designs, and marketing assets. This skill should be used when users want expert feedback on marketing materials, need to evaluate creative work quality, or want to iterate on designs until they achieve a 90+ score. Triggers on requests like "review this ad", "evaluate this landing page", "critique this design", or "get marketing feedback".
---

# Marketing Panel Review

Assemble a panel of 10 world-class experts to provide comprehensive review and scoring of marketing assets. The panel evaluates work, provides actionable feedback, and guides iteration until excellence is achieved.

## The Expert Panel

The panel consists of 10 specialists, each evaluating from their domain expertise:

| # | Expert | Focus Question |
|---|--------|----------------|
| 1 | **Strategy & Positioning** | Is the core intent clear? |
| 2 | **Design & Visual Communication** | Does the form support the function? |
| 3 | **Psychology & Persuasion** | Does it motivate the desired action? |
| 4 | **Copywriting & Messaging** | Is the language compelling and clear? |
| 5 | **User Experience** | Is it intuitive and friction-free? |
| 6 | **Technical Execution** | Is it built correctly? |
| 7 | **Domain Expertise** | Does it meet industry-specific standards? |
| 8 | **Audience Fit** | Does it resonate with the intended recipient? |
| 9 | **Conversion & Effectiveness** | Will it achieve its goal? |
| 10 | **Originality & Differentiation** | Does it stand out? |

## Individual Expert Review Format

For each expert, provide:

```
### [Expert Name] — [Domain]
**Score: [0-100]**

**Strengths:**
- [Specific strength 1]
- [Specific strength 2]
- [Specific strength 3 if applicable]

**Weaknesses & Fixes:**
- [Weakness 1] → [Actionable fix]
- [Weakness 2] → [Actionable fix]
- [Weakness 3 if applicable] → [Actionable fix]

**Goal Achievement:** [Yes/No] — [Brief explanation of why/why not]
```

## Scoring Criteria

Calculate weighted scores based on content type. Default weights:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Clarity of Purpose | 0-15 | Is the intent obvious within 5 seconds? |
| Execution Quality | 0-20 | Is it well-crafted? |
| Persuasiveness | 0-20 | Does it compel action? |
| Audience Fit | 0-15 | Does it speak to the right people in the right way? |
| Differentiation | 0-15 | Does it stand out from alternatives? |
| Technical Soundness | 0-15 | Is it error-free and functional? |

**Total: 100 points**

Adjust weights based on content type:
- **Ad Copy**: Increase Persuasiveness, decrease Technical Soundness
- **Landing Pages**: Balance all criteria evenly
- **Web Design**: Increase Execution Quality and Technical Soundness
- **Brand Assets**: Increase Differentiation and Audience Fit

## Panel Debate

After individual reviews, the panel debates three questions:

1. **Highest-Impact Improvements**: What are the 3 changes that would most improve this work?
2. **Strongest Element**: What's the single strongest element to preserve at all costs?
3. **Path to Excellence**: What's the one thing that would elevate this from good to exceptional?

Format the debate as a discussion showing different expert perspectives and arriving at consensus recommendations.

## Review Process

1. **Initial Review**: Run the full panel review with all 10 experts
2. **Calculate Average**: Compute the average score across all experts
3. **Threshold Check**:
   - If average ≥ 90 → Deliver final version with summary
   - If average < 90 → Continue to step 4
4. **Implement Improvements**: Apply the panel's top recommendations
5. **Re-Review**: Run panel review again on improved version
6. **Iterate**: Repeat steps 2-5 until average hits 90+
7. **Final Delivery**: Return the final version with:
   - Complete iteration history
   - Summary of all changes made
   - Final panel scores

## Output Structure

Present all work transparently:

```
# Marketing Panel Review

## Content Under Review
[Description/screenshot/content being reviewed]

## Round 1 Review

### Individual Expert Scores
[All 10 expert reviews in format above]

### Score Summary
| Expert | Score |
|--------|-------|
| Strategy & Positioning | XX |
| Design & Visual Communication | XX |
| ... | ... |
| **Average** | **XX** |

### Panel Debate
[Debate discussion and consensus]

---

## Round 2 Review (if needed)

### Changes Implemented
- [Change 1 based on panel feedback]
- [Change 2]
- [Change 3]

### Individual Expert Scores
[Updated reviews]

### Score Summary
[Updated scores]

---

## Final Deliverable

### Summary of Changes
[Complete list of improvements made across all iterations]

### Final Scores
[Final score summary showing 90+ average]

### Final Version
[The polished, panel-approved result]
```

## Usage Examples

**Reviewing ad copy:**
> "Review this Facebook ad for our SaaS product: [ad text]"

**Evaluating a landing page:**
> "Run the marketing panel on this landing page design: [screenshot/URL]"

**Iterating on design:**
> "Get panel feedback on this email campaign and iterate until it scores 90+"

**Domain-specific review:**
> "Have the panel review this B2B whitepaper landing page with extra weight on Domain Expertise"
