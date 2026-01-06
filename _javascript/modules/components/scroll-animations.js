/**
 * Phase 3: Scroll-triggered section animations
 * Content sections fade in as they enter viewport using Intersection Observer
 */

export function initScrollAnimations() {
  // Check if user prefers reduced motion
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (prefersReducedMotion) {
    return;
  }

  // Check if mobile (disabled on mobile for battery)
  const isMobile = window.innerWidth <= 849;

  if (isMobile) {
    return;
  }

  // Only on blog post pages
  const article = document.querySelector('article.px-1');

  if (!article) {
    return;
  }

  // Check for Intersection Observer support
  if (!('IntersectionObserver' in window)) {
    return;
  }

  animateOnScroll();
}

/**
 * Animate elements as they scroll into view
 * Section-based approach for smoother, less jolty experience
 */
function animateOnScroll() {
  // Target only major section headers (h2) for smooth, section-based animation
  // This creates fewer triggers and a more cohesive reading experience
  const elements = document.querySelectorAll('.content h2');

  if (elements.length === 0) {
    return;
  }

  // Create observer with higher threshold and early trigger
  // Higher threshold (0.35) means more of the element must be visible
  // rootMargin triggers animation slightly before element enters viewport
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('scroll-fade-in');
          // Unobserve after animation to prevent re-triggering
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.35, // Element must be 35% visible before animating
      rootMargin: '50px' // Trigger 50px before element enters viewport
    }
  );

  // Observe each element
  elements.forEach((el) => {
    observer.observe(el);
  });
}
