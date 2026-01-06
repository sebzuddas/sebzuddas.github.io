# Backlog

## Overview
Personal website and blog built on Jekyll + Chirpy theme. Focus: systems thinking, control engineering, technology. Hosted on GitHub Pages.

---

## Content

### Draft Posts (14 total)
**Status:** 🔲 Not Started (needs review/prioritization)

**Drafts Identified:**
- disruption-in-the-next-quarter-century.md
- 5-lessons-from-the-worlds-most-ambitious-rooms.md (referenced in recent commits)
- [12 other drafts in _drafts/]

**Next Steps:**
- [ ] Review draft completion status
- [ ] Prioritize for publication
- [ ] Edit and finalize selected drafts
- [ ] Add images/diagrams as needed

---

## Features

### PWA Enhancements
**Status:** ✅ Implemented

**Current State:**
- Service worker configured
- Offline caching enabled
- App manifest present

**Possible Improvements:**
- [ ] Review cache strategy
- [ ] Test offline functionality
- [ ] Optimize cached resources

---

### Custom Tabs/Pages
**Status:** ✅ Implemented (10 tabs)

**Existing:**
- About, Archives, Categories, Tags
- Projects, Books, Photos, Videos
- Wiki, Shop

**Possible Additions:**
- [ ] Define additional tab needs
- [ ] Review content completeness per tab

---

### Analytics & Monitoring
**Status:** ✅ Implemented

**Current:**
- Google Analytics: G-4GKWLFQBB8

**Review:**
- [ ] Verify tracking coverage
- [ ] Review conversion goals
- [ ] Check performance metrics

---

## Design & User Experience

### Animation Enhancements
**Status:** ✅ Phase 1 & 2 Complete, Phase 3 Optional

**Phase 1 - Completed (2026-01-06):**
- [x] Enhanced sidebar navigation hover states (scale, icon animation, pulse)
- [x] Enhanced back-to-top button (lift effect, rotation)
- [x] Enhanced post card hover effects (lift, glow, depth)
- [x] Newsletter modal enhancements (spring entrance, backdrop blur)
- [x] Smooth scroll behavior site-wide
- [x] Subtle grain texture background (sidebar overlay)
- [x] Mobile optimizations and accessibility (prefers-reduced-motion)

**Phase 2 - Completed (2026-01-06):**
- [x] Staggered entrance animations for post cards on homepage
- [x] Sequential fade-in for post content sections
- [x] Interactive tag/category hover states (spring scale effect)
- [x] Standardized all glow effects with consistent blue color
- [x] Full mobile optimization (animations disabled on <849px)
- [x] Accessibility support (respects prefers-reduced-motion)
- [~] ~~Sidebar slide-in animation~~ (removed - better stability)

**Phase 3 - Optional Polish:**
- [x] Post reading progress indicator
- [x] Scroll-triggered section animations (intersection observer)
- [x] Dark/light mode transition animation

**Documentation:**
- Technical guide: `docs/ANIMATION_IMPLEMENTATION.md`
- Decision rationale: `docs/DECISIONS.md`
- Implementation: `_sass/addon/animations.scss`

---

## Technical Improvements

### Build Optimization
**Status:** 🔲 Not Started

**Potential Work:**
- [ ] Review PurgeCSS configuration for unused CSS
- [ ] Analyze bundle sizes
- [ ] Optimize image assets
- [ ] Review JavaScript module structure

---

### Content Management
**Status:** 🔲 Not Started

**Considerations:**
- [ ] Draft workflow optimization
- [ ] Image asset organization strategy
- [ ] Tag/category taxonomy review

---

### Testing & Quality
**Status:** ⚠️ Partially Implemented

**Current:**
- HTML Proofer validation in CI/CD
- Stylelint configured
- Commitlint with Husky hooks

**Gaps:**
- [ ] Accessibility testing
- [ ] Cross-browser testing strategy
- [ ] Performance budget definition

---
