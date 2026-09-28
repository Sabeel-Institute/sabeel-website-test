// BackstopJS runs this before loading each page. Reduced motion, a fixed
// clock, and a seeded Math.random make two loads of the same page behave the
// same way.
module.exports = async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2026-01-01T12:00:00Z'));
  await page.addInitScript(() => {
    let seed = 1;
    Math.random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  });
};
