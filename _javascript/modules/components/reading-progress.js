/**
 * Phase 3: Reading progress indicator for blog posts
 * Shows scroll progress at top of page with smooth animation
 */

export function initReadingProgress() {
  // Check if user prefers reduced motion
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  // Skip if user prefers reduced motion
  if (prefersReducedMotion) {
    return;
  }

  // Check if mobile (disabled on mobile for battery)
  const isMobile = window.innerWidth <= 849;

  if (isMobile) {
    return;
  }

  // Only show on blog post pages (has article.px-1)
  const article = document.querySelector('article.px-1');

  if (!article) {
    return;
  }

  // Create progress bar element
  const progressBar = createProgressBar();
  document.body.appendChild(progressBar);

  // Update progress on scroll (throttled for performance)
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateProgress(progressBar);
        ticking = false;
      });
      ticking = true;
    }
  });

  // Set initial progress
  updateProgress(progressBar);
}

/**
 * Create progress bar element
 */
function createProgressBar() {
  const bar = document.createElement('div');
  bar.id = 'reading-progress';
  bar.setAttribute('aria-hidden', 'true');

  const fill = document.createElement('div');
  fill.className = 'reading-progress-fill';
  bar.appendChild(fill);

  return bar;
}

/**
 * Update progress bar width based on scroll position
 */
function updateProgress(progressBar) {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = (scrollTop / docHeight) * 100;

  const fill = progressBar.querySelector('.reading-progress-fill');
  fill.style.transform = `scaleX(${Math.min(progress, 100) / 100})`;
}
