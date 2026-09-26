import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        mission: resolve(__dirname, 'our-mission.html'),
        team: resolve(__dirname, 'our-team.html'),
        seminary: resolve(__dirname, 'seminary.html'),
        courses: resolve(__dirname, 'courses.html'),
        pastCourses: resolve(__dirname, 'past-courses.html'),
        financialAid: resolve(__dirname, 'financial-aid.html'),
        donate: resolve(__dirname, 'donate.html'),
        contact: resolve(__dirname, 'contact.html'),
        blog: resolve(__dirname, 'blog.html'),
        testimonials: resolve(__dirname, 'testimonials.html')
      }
    }
  }
});