/**
 * Phase 2: Entrance animations for post cards and content sections
 * Professional staggered fade-up effects with accessibility support
 */

export function initEntranceAnimations() {
  // Check if user prefers reduced motion
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  // Skip animations if user prefers reduced motion
  if (prefersReducedMotion) {
    return;
  }

  // Check if mobile (animations disabled on mobile for battery)
  const isMobile = window.innerWidth <= 849;

  if (isMobile) {
    return;
  }

  // 1. Staggered post card animations on homepage
  animatePostCards();

  // 2. Sequential content section fade-in on blog posts
  animatePostContent();
}

/**
 * Staggered fade-up for post cards on homepage
 */
function animatePostCards() {
  const postCards = document.querySelectorAll('.card-wrapper.card');

  if (postCards.length === 0) {
    return;
  }

  postCards.forEach((card, index) => {
    // Add base animation class
    card.classList.add('animate-fade-up');

    // Add stagger delay (max 10 cards to avoid excessive delays)
    const delayIndex = Math.min(index + 1, 10);
    card.classList.add(`animate-delay-${delayIndex}`);
  });
}

/**
 * Sequential fade-in for post content sections
 */
function animatePostContent() {
  const article = document.querySelector('article.px-1');

  if (!article) {
    return;
  }

  // Animate header first
  const header = article.querySelector('header');

  if (header) {
    header.classList.add('post-content-section');
  }

  // Animate main content with delay
  const content = article.querySelector('.content');

  if (content) {
    content.classList.add('post-content-section');
    content.style.animationDelay = '200ms';
  }
}
