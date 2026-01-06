# Open Questions

## Content Strategy

- [ ] What is the publication schedule/frequency goal? — 14 drafts pending, prioritization needed
- [ ] Which drafts are highest priority? — "disruption-in-the-next-quarter-century.md" and "5-lessons-from-the-worlds-most-ambitious-rooms.md" mentioned in recent commits
- [ ] Is there a content calendar or editorial workflow? — No evidence found in codebase

## Feature Completeness

- [ ] Are all custom tabs (Books, Wiki, Shop, Photos, Videos) fully populated? — Need content review
- [ ] Is the newsletter integration active? — Include found (`_includes/newsletter.html`) but implementation unclear
- [ ] Is commenting system intended? — Support exists but disabled
- [ ] What social media integration is desired? — Share buttons configured, but posting automation?

## Technical

- [ ] What is the target build time threshold? — Current build time unknown, scalability concern as content grows
- [ ] Are there any performance budgets? — Lighthouse scores, bundle size limits undefined
- [ ] Is there a backup strategy beyond git? — GitHub is single point of truth
- [ ] Are there any accessibility requirements/targets? — WCAG compliance level?

## Analytics & SEO

- [ ] What are the key conversion goals? — Newsletter signup? Reading time? Other?
- [ ] Is current SEO configuration optimal? — Review meta tags, structured data
- [ ] Are analytics tracking all important events? — Custom event tracking configured?

## Workflow

- [ ] What is the branch protection strategy on master? — Push triggers deploy, protection status unknown
- [ ] Is there a staging environment? — Only production visible
- [ ] What is the review process for content? — Solo author or collaborative?

---
