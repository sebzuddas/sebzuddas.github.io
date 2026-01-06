# Decisions

## 2026-01-06: Architecture Documentation

**Context:** Initial documentation of existing codebase structure and decisions.

**Key Architectural Decisions Identified:**

1. **Static Site Generator: Jekyll + Chirpy Theme**
   - Rationale: Mature ecosystem, GitHub Pages native support, excellent for technical blogging
   - Tradeoffs: Ruby dependency, slower builds than alternatives (Hugo), limited to Liquid templating
   - Alternatives considered: Likely none (pre-existing choice)

2. **Hosting: GitHub Pages**
   - Rationale: Free, integrated with GitHub workflow, automatic SSL, CDN
   - Tradeoffs: Limited server-side capabilities, build constraints
   - Alternative: Self-hosted, Netlify, Vercel

3. **Frontend Build: Rollup + Babel**
   - Rationale: Efficient bundling, ES6+ support, tree-shaking
   - Tradeoffs: Additional build step, configuration complexity
   - Alternative: Webpack, esbuild, no bundler

4. **CSS Optimization: PurgeCSS**
   - Rationale: Removes unused Bootstrap CSS, reduces bundle size
   - Tradeoffs: Requires safelist maintenance, build time overhead
   - Alternative: Use minimal CSS framework, custom CSS only

5. **PWA Implementation**
   - Rationale: Offline access, improved mobile experience, installability
   - Tradeoffs: Service worker complexity, cache management overhead
   - Alternative: Standard web app without offline support

6. **Content Organization: Drafts + Posts + Tabs**
   - Rationale: Clear separation of published/unpublished, flexible navigation
   - Tradeoffs: Requires manual draft promotion
   - Alternative: CMS integration, date-based publishing workflow

7. **Multi-locale Support**
   - Rationale: Future internationalization capability
   - Tradeoffs: Increased complexity, currently underutilized (English only)
   - Alternative: English-only with simpler i18n approach

8. **Git Hooks: Husky + Commitlint**
   - Rationale: Enforce conventional commits, maintain clean git history
   - Tradeoffs: Additional developer friction, commit message discipline required
   - Alternative: No enforcement, manual review

---

## 2026-01-06: Phase 1 Animation Implementation

**Context:** Enhance user experience with professional animations while maintaining performance and accessibility.

**Decision:** Implement balanced, GPU-accelerated animations with full accessibility support.

**Approach:**
- Created dedicated animations.scss with centralized keyframes and utilities
- Used CSS custom properties for consistent timing across all animations
- Applied animations only to transform and opacity (GPU-accelerated properties)
- Implemented comprehensive prefers-reduced-motion support
- Disabled intensive animations on mobile devices

**Key Implementation Decisions:**

1. **Animation Style: Balanced Professional**
   - Rationale: "Amongst the best blogs" requires polish without being flashy
   - Chosen: Subtle hover states, spring easing for modals, gentle grain texture
   - Rejected: Extreme parallax, bouncy animations, distracting effects
   - Timing: All interactions under 500ms for responsiveness

2. **Grain Texture Background**
   - Rationale: Adds visual interest and depth without compromising readability
   - Chosen: SVG-based fractal noise, opacity 0.08, 25s slow animation
   - Applied: Sidebar on desktop only
   - Disabled: Mobile devices (battery), reduced motion preference
   - Alternative considered: Canvas-based grain (rejected: overkill, accessibility issues)

3. **Performance Strategy**
   - Rationale: Static sites should be fast; animations must not compromise this
   - GPU-only properties: transform, opacity exclusively
   - Mobile optimizations: Reduced/disabled animations on screens ≤849px
   - Backdrop blur: Implemented with fallback for unsupported browsers
   - No JavaScript animations (CSS only, leveraging browser optimization)

4. **Accessibility Approach**
   - Rationale: Animations can cause issues for users with vestibular disorders
   - Full prefers-reduced-motion support (all animations nearly instant)
   - Maintained visual feedback for usability (instant state changes)
   - Keyboard navigation unaffected
   - Screen reader compatibility preserved

5. **Code Organization**
   - Rationale: Maintainable, scalable animation system
   - Single source of truth: _sass/addon/animations.scss
   - CSS custom properties for easy global timing adjustments
   - Component-scoped rules to avoid conflicts
   - Comprehensive comments for future developers

6. **Mobile-First Battery Optimization**
   - Rationale: Touch devices benefit less from hover states, battery life matters
   - Grain animation disabled on mobile
   - Reduced transform values (4px vs 8px lifts)
   - Backdrop blur disabled on mobile
   - Faster transitions (150ms vs 250ms)

**Components Enhanced:**
- Sidebar navigation (scale, icon slide, subtle pulse)
- Back-to-top button (lift, icon rotation, entrance animation)
- Post cards (lift, shadow, border glow)
- Newsletter modal (spring entrance, backdrop blur, rotate close button)
- Smooth scroll (HTML scroll-behavior)
- Grain texture (sidebar and optional body overlay)

**Tradeoffs:**
- Pros: Professional feel, enhanced UX, accessible, performant
- Cons: Slight increase in CSS bundle size (~3KB gzipped), grain SVG not visible in IE11 (acceptable - EOL browser)
- Maintenance: Requires testing on new components to ensure consistent feel

**Alternatives Considered:**
- JavaScript-based animations (GSAP, Framer Motion): Rejected - overkill, bundle size
- More extreme animations (3D transforms, parallax): Rejected - not aligned with "professional but interesting" tone
- No animations: Rejected - site would feel flat compared to modern web standards

**Testing Performed:**
- Desktop hover states (Chrome, Firefox, Safari)
- Mobile touch interactions (iOS Safari, Chrome Android)
- Accessibility (prefers-reduced-motion on macOS)
- Build process (Jekyll compilation successful)
- Performance (60fps animations, no jank)

**Future Considerations:**
- Phase 2 could add: page transitions, scroll-triggered animations, staggered lists
- Monitor user feedback on animation timing/intensity
- Consider A/B testing grain texture visibility (opacity adjustment)

**Documentation:**
- Comprehensive guide: docs/ANIMATION_IMPLEMENTATION.md (320+ lines)
- Inline code comments in animations.scss
- Rollback instructions provided

---
