/**
 * Phase 3: Reading progress indicator for blog posts
 * Shows scroll progress at top of page with dynamic glow and completion state
 */

// State tracking
let hasCompleted = false; // Track if 100% reached
let lastScrollPercent = 0; // Track previous scroll position

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
 * Update progress bar with dynamic glow and color transitions
 */
function updateProgress(progressBar) {
  const article = document.querySelector('article.px-1');
  const progressFill = progressBar.querySelector('.reading-progress-fill');

  if (!article || !progressFill) {
    return;
  }

  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollableHeight = documentHeight - windowHeight;

  // Calculate scroll percentage (0.0 to 1.0)
  let scrollPercent = Math.min(scrollTop / scrollableHeight, 1.0);

  // If already completed, keep bar at 100% and maintain completion state
  if (hasCompleted) {
    progressFill.style.transform = 'scaleX(1)';
    return; // Don't update glow, keep completion state
  }

  // Update bar width
  progressFill.style.transform = `scaleX(${scrollPercent})`;

  // Calculate glow intensity and color based on phase
  let glowMultiplier;
  let colorProgress;

  if (scrollPercent < 0.95) {
    // Phase 1: Linear glow increase 1.0x → 2.5x
    glowMultiplier = 1.0 + (scrollPercent / 0.95) * 1.5; // 1.0 to 2.5
    colorProgress = 0; // Stay blue
  } else {
    // Phase 2: Accelerated glow 2.5x → 3.5x, start color transition
    const phase2Progress = (scrollPercent - 0.95) / 0.05; // 0 to 1 over last 5%
    glowMultiplier = 2.5 + phase2Progress * 1.0; // 2.5 to 3.5
    colorProgress = phase2Progress; // 0 to 1 for color lerp
  }

  // Apply dynamic glow (multiply base blur/spread values)
  applyDynamicGlow(progressFill, glowMultiplier, colorProgress);

  // Check for completion
  if (scrollPercent >= 1.0 && !hasCompleted) {
    triggerCompletion(progressFill);
    hasCompleted = true;
  }

  lastScrollPercent = scrollPercent;
}

/**
 * Apply dynamic glow with color interpolation
 */
function applyDynamicGlow(element, multiplier, colorProgress) {
  // Interpolate between blue and cyan
  const startColor = { r: 138, g: 180, b: 248 }; // Blue
  const endColor = { r: 100, g: 220, b: 255 }; // Cyan

  const r = Math.round(
    startColor.r + (endColor.r - startColor.r) * colorProgress
  );
  const g = Math.round(
    startColor.g + (endColor.g - startColor.g) * colorProgress
  );
  const b = Math.round(
    startColor.b + (endColor.b - startColor.b) * colorProgress
  );

  // Update gradient background
  element.style.background = `
    linear-gradient(90deg,
      transparent 0%,
      transparent 30%,
      rgba(255, 255, 255, 0.6) 50%,
      transparent 70%,
      transparent 100%
    ),
    linear-gradient(90deg,
      rgba(255, 255, 255, 0.9) 0%,
      rgb(${r}, ${g}, ${b}) 50%,
      rgba(255, 255, 255, 0.9) 100%
    )
  `;

  element.style.backgroundSize = '200px 100%, 100% 100%';
  element.style.backgroundPosition = '-200px 0, 0 0';
  element.style.backgroundRepeat = 'no-repeat';

  // Calculate dynamic box-shadow with multiplier
  const baseBlurs = [4, 8, 12, 16, 24, 32, 48, 64];
  const shadows = baseBlurs
    .map((blur, index) => {
      const adjustedBlur = blur * multiplier;
      const opacity = [0.9, 0.7, 0.9, 0.8, 0.6, 0.5, 0.4, 0.2][index];
      const color = index < 2 ? '255, 255, 255' : `${r}, ${g}, ${b}`;
      return `0 0 ${adjustedBlur}px rgba(${color}, ${opacity})`;
    })
    .join(', ');

  element.style.boxShadow = shadows;
}

/**
 * Trigger completion state with celebration animations
 */
function triggerCompletion(element) {
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  // Set completion state
  element.setAttribute('data-completed', 'true');

  // Apply final cyan color and 4x glow
  element.style.background = `
    linear-gradient(90deg,
      transparent 0%,
      transparent 30%,
      rgba(255, 255, 255, 0.6) 50%,
      transparent 70%,
      transparent 100%
    ),
    linear-gradient(90deg,
      rgba(255, 255, 255, 0.9) 0%,
      rgb(100, 220, 255) 50%,
      rgba(255, 255, 255, 0.9) 100%
    )
  `;

  element.style.backgroundSize = '200px 100%, 100% 100%';
  element.style.backgroundPosition = '-200px 0, 0 0';
  element.style.backgroundRepeat = 'no-repeat';

  // Enhanced cyan glow (4x)
  const finalShadows = [
    '0 0 4px rgba(255, 255, 255, 0.9)',
    '0 0 8px rgba(255, 255, 255, 0.7)',
    '0 0 12px rgba(100, 220, 255, 0.9)',
    '0 0 16px rgba(100, 220, 255, 0.8)',
    '0 0 24px rgba(100, 220, 255, 0.6)',
    '0 0 32px rgba(100, 220, 255, 0.5)',
    '0 0 48px rgba(100, 220, 255, 0.4)',
    '0 0 64px rgba(100, 220, 255, 0.2)',
    '0 0 80px rgba(100, 220, 255, 0.15)',
    '0 0 96px rgba(100, 220, 255, 0.1)'
  ].join(', ');

  element.style.boxShadow = finalShadows;

  // Skip animations if reduced motion preferred
  if (prefersReducedMotion) {
    return;
  }

  // Trigger one-time animations
  triggerParticleBurst(element);
  triggerShimmerFlash(element);

  // Start continuous pulse
  element.style.animation =
    'completion-pulse 3s ease-in-out infinite, shimmer-travel 3.5s linear infinite';
}

/**
 * Trigger particle burst effect
 */
function triggerParticleBurst(element) {
  element.classList.add('particle-burst');

  // Remove class after animation completes
  setTimeout(() => {
    element.classList.remove('particle-burst');
  }, 2000);
}

/**
 * Trigger shimmer flash effect
 */
function triggerShimmerFlash(element) {
  element.classList.add('shimmer-flash');

  // Remove class after animation completes
  setTimeout(() => {
    element.classList.remove('shimmer-flash');
  }, 800);
}
