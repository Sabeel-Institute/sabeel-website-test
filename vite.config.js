import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        about: resolve(import.meta.dirname, 'about.html'),
        mission: resolve(import.meta.dirname, 'our-mission.html'),
        team: resolve(import.meta.dirname, 'our-team.html'),
        seminary: resolve(import.meta.dirname, 'seminary.html'),
        courses: resolve(import.meta.dirname, 'courses.html'),
        past_courses: resolve(import.meta.dirname, 'past-courses.html'),
        financial_aid: resolve(import.meta.dirname, 'financial-aid.html'),
        donate: resolve(import.meta.dirname, 'donate.html'),
        contact: resolve(import.meta.dirname, 'contact.html'),
        blog: resolve(import.meta.dirname, 'blog.html'),
        testimonials: resolve(import.meta.dirname, 'testimonials.html'),
      },
    },
  },
});
