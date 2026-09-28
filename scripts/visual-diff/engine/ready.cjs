// BackstopJS runs this in every page just before its screenshot. It loads
// lazy images and waits for the page, its images, and its web fonts, each
// for at most WAIT milliseconds. It then stops anything still loading, which
// would otherwise hold up the screenshot, and brings every animation and
// transition to a fixed state, so that two captures of the same page are
// identical pixel for pixel.
const WAIT = 10000;

module.exports = async (page) => {
  await page.evaluate(async (wait) => {
    const settle = (promise) => Promise.race([promise, new Promise((resolve) => setTimeout(resolve, wait))]);
    if (document.readyState !== 'complete') {
      await settle(new Promise((resolve) => addEventListener('load', resolve, { once: true })));
    }
    for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
    await settle(Promise.all([...document.images].map((img) => img.decode().catch(() => {}))));
    await settle(document.fonts.ready);
    window.stop();
    // Let animations that scripts start on the next frames begin, then bring
    // them to a fixed state: finite animations jump to their end, endless ones
    // go back to the start.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (const animation of document.getAnimations()) {
      try {
        if (animation.effect?.getComputedTiming().endTime === Infinity) animation.cancel();
        else animation.finish();
      } catch {
        animation.cancel();
      }
    }
    for (const svg of document.querySelectorAll('svg')) {
      svg.pauseAnimations();
      svg.setCurrentTime(0);
    }
  }, WAIT);
};
