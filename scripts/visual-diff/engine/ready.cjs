// BackstopJS runs this in every page just before its screenshot. It turns off
// motion, loads lazy images and waits for web fonts, so that two captures of
// the same page are identical pixel for pixel.
module.exports = async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    await document.fonts.ready;
  });
};
