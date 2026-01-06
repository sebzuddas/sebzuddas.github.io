/**
 * Newsletter modal functionality
 * Shows once per browser session using sessionStorage
 */

// Show newsletter modal after delay (once per session)
document.addEventListener('DOMContentLoaded', () => {
  const backdrop = document.getElementById('newsletter-backdrop');

  if (!backdrop) {
    return;
  }

  // Check if modal was already shown this session
  try {
    const hasShownModal = sessionStorage.getItem('newsletterShown');

    if (hasShownModal === 'true') {
      // Already shown this session, don't show again
      return;
    }

    // Show modal after 12 second delay (allows user to start reading)
    setTimeout(() => {
      backdrop.classList.remove('newsletter-hidden');

      // Mark as shown for this session
      try {
        sessionStorage.setItem('newsletterShown', 'true');
      } catch (e) {
        // Storage not available (Safari private mode), ignore
        console.info('sessionStorage not available, newsletter tracking disabled');
      }
    }, 12000); // 12 seconds

  } catch (e) {
    // sessionStorage not available (Safari private mode)
    // Fallback: show modal once anyway (no tracking)
    console.info('sessionStorage not available, showing newsletter modal once');
    setTimeout(() => {
      backdrop.classList.remove('newsletter-hidden');
    }, 12000);
  }
});

// Close newsletter modal function (called by onclick in HTML)
window.closeNewsletterModal = function() {
  const backdrop = document.getElementById('newsletter-backdrop');

  if (backdrop) {
    backdrop.classList.add('newsletter-hidden');
  }

  // Ensure session flag is set when user dismisses
  try {
    sessionStorage.setItem('newsletterShown', 'true');
  } catch (e) {
    // Storage not available, ignore
  }
};
