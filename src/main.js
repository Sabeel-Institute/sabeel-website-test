import './style.css';

export function renderHeader() {
  const headerContainer = document.getElementById('header-container');
  if (!headerContainer) return;

  const currentPath = window.location.pathname;

  headerContainer.innerHTML = `
    <!-- Top Announcement Bar -->
    <div class="bg-sabeel-raspberry text-white py-2 px-4 text-center text-xs md:text-sm font-medium flex justify-between items-center max-w-full">
      <div class="hidden sm:block flex-1"></div>
      <div class="flex-1 text-center font-medium tracking-wide">
        ✨ Registration Open for Spring Semester Courses & Gatherings!
      </div>
      <div class="flex-1 text-right text-xs">
        <a href="courses.html" class="underline hover:text-sabeel-gold transition">Explore Courses &rarr;</a>
      </div>
    </div>

    <!-- Main Navigation Header -->
    <header class="bg-sabeel-ivory border-b border-sabeel-gold/20 sticky top-0 z-50 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-20">

          <!-- Brand Logo -->
          <a href="index.html" class="flex items-center gap-3 group">
            <img src="/images/sabeel-institute-PNG-1.png" alt="Sabeel Institute Logo" class="h-10 w-auto transition transform group-hover:scale-105" onerror="this.onerror=null; this.src='/images/IMG_7959.png'" />
            <div class="hidden md:block">
              <span class="block font-serif text-lg font-bold tracking-wider text-sabeel-raspberry uppercase">Sabeel Institute</span>
              <span class="block text-[10px] text-sabeel-taupe tracking-widest uppercase">Houston, Texas</span>
            </div>
          </a>

          <!-- Desktop Navigation Menu -->
          <nav class="hidden lg:flex items-center space-x-6 text-sm font-medium text-sabeel-dark">
            <a href="index.html" class="hover:text-sabeel-raspberry transition ${currentPath.endsWith('index.html') || currentPath === '/' ? 'text-sabeel-raspberry font-semibold border-b-2 border-sabeel-raspberry pb-1' : ''}">Home</a>

            <!-- About Dropdown -->
            <div class="relative group">
              <a href="about.html" class="hover:text-sabeel-raspberry transition flex items-center gap-1 ${currentPath.includes('about') || currentPath.includes('mission') ? 'text-sabeel-raspberry font-semibold' : ''}">
                About
                <svg class="w-4 h-4 text-sabeel-taupe group-hover:text-sabeel-raspberry transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </a>
              <div class="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-sabeel-gold/20 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <a href="about.html" class="block px-4 py-2 text-sm text-sabeel-dark hover:bg-sabeel-ivory hover:text-sabeel-raspberry">About Sabeel</a>
                <a href="our-mission.html" class="block px-4 py-2 text-sm text-sabeel-dark hover:bg-sabeel-ivory hover:text-sabeel-raspberry">Our Mission</a>
                <a href="our-team.html" class="block px-4 py-2 text-sm text-sabeel-dark hover:bg-sabeel-ivory hover:text-sabeel-raspberry">Our Team & Instructors</a>
                <a href="testimonials.html" class="block px-4 py-2 text-sm text-sabeel-dark hover:bg-sabeel-ivory hover:text-sabeel-raspberry">Student Testimonials</a>
              </div>
            </div>

            <a href="seminary.html" class="hover:text-sabeel-raspberry transition ${currentPath.includes('seminary') ? 'text-sabeel-raspberry font-semibold border-b-2 border-sabeel-raspberry pb-1' : ''}">Hikam Seminary</a>
            <a href="courses.html" class="hover:text-sabeel-raspberry transition ${currentPath.includes('courses') && !currentPath.includes('past') ? 'text-sabeel-raspberry font-semibold border-b-2 border-sabeel-raspberry pb-1' : ''}">Courses</a>
            <a href="past-courses.html" class="hover:text-sabeel-raspberry transition ${currentPath.includes('past-courses') ? 'text-sabeel-raspberry font-semibold border-b-2 border-sabeel-raspberry pb-1' : ''}">Past Courses</a>
            <a href="financial-aid.html" class="hover:text-sabeel-raspberry transition ${currentPath.includes('financial-aid') ? 'text-sabeel-raspberry font-semibold border-b-2 border-sabeel-raspberry pb-1' : ''}">Financial Aid</a>
            <a href="blog.html" class="hover:text-sabeel-raspberry transition ${currentPath.includes('blog') ? 'text-sabeel-raspberry font-semibold border-b-2 border-sabeel-raspberry pb-1' : ''}">Blog</a>
            <a href="contact.html" class="hover:text-sabeel-raspberry transition ${currentPath.includes('contact') ? 'text-sabeel-raspberry font-semibold border-b-2 border-sabeel-raspberry pb-1' : ''}">Contact</a>
          </nav>

          <!-- Action Buttons -->
          <div class="hidden sm:flex items-center gap-4">
            <a href="donate.html" class="bg-sabeel-raspberry hover:bg-sabeel-raspberry-dark text-white px-5 py-2.5 rounded-full font-medium text-sm transition shadow-md hover:shadow-lg flex items-center gap-2">
              <svg class="w-4 h-4 text-sabeel-gold" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>
              Donate Now
            </a>
          </div>

          <!-- Mobile Menu Button -->
          <div class="flex lg:hidden items-center gap-3">
            <a href="donate.html" class="bg-sabeel-raspberry text-white px-3 py-1.5 rounded-full font-medium text-xs">Donate</a>
            <button id="mobile-menu-btn" class="p-2 text-sabeel-dark hover:text-sabeel-raspberry focus:outline-none" aria-label="Toggle Navigation">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
          </div>

        </div>
      </div>

      <!-- Mobile Dropdown Drawer -->
      <div id="mobile-menu" class="hidden lg:hidden bg-sabeel-ivory border-b border-sabeel-gold/30 px-4 pt-2 pb-6 space-y-3">
        <a href="index.html" class="block py-2 text-sabeel-dark hover:text-sabeel-raspberry font-medium">Home</a>
        <a href="about.html" class="block py-2 text-sabeel-dark hover:text-sabeel-raspberry font-medium">About Sabeel</a>
        <a href="our-mission.html" class="block py-2 pl-4 text-sm text-sabeel-taupe hover:text-sabeel-raspberry">Our Mission</a>
        <a href="our-team.html" class="block py-2 pl-4 text-sm text-sabeel-taupe hover:text-sabeel-raspberry">Our Team & Instructors</a>
        <a href="testimonials.html" class="block py-2 pl-4 text-sm text-sabeel-taupe hover:text-sabeel-raspberry">Testimonials</a>
        <a href="seminary.html" class="block py-2 text-sabeel-dark hover:text-sabeel-raspberry font-medium">Hikam Seminary</a>
        <a href="courses.html" class="block py-2 text-sabeel-dark hover:text-sabeel-raspberry font-medium">Courses</a>
        <a href="past-courses.html" class="block py-2 text-sabeel-dark hover:text-sabeel-raspberry font-medium">Past Courses</a>
        <a href="financial-aid.html" class="block py-2 text-sabeel-dark hover:text-sabeel-raspberry font-medium">Financial Aid</a>
        <a href="blog.html" class="block py-2 text-sabeel-dark hover:text-sabeel-raspberry font-medium">Blog</a>
        <a href="contact.html" class="block py-2 text-sabeel-dark hover:text-sabeel-raspberry font-medium">Contact</a>
        <div class="pt-2">
          <a href="donate.html" class="block text-center bg-sabeel-raspberry text-white py-2.5 rounded-full font-medium text-sm">Donate Now</a>
        </div>
      </div>
    </header>
  `;

  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      menu.classList.toggle('hidden');
    });
  }
}

export function renderFooter() {
  const footerContainer = document.getElementById('footer-container');
  if (!footerContainer) return;

  footerContainer.innerHTML = `
    <!-- Footer Section -->
    <footer class="bg-sabeel-sage text-sabeel-dark pt-16 pb-12 border-t border-sabeel-gold/30 relative">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          <!-- Col 1: Brand Info -->
          <div class="space-y-4">
            <a href="index.html" class="flex items-center gap-3">
              <img src="/images/sabeel-institute-PNG-1.png" alt="Sabeel Institute" class="h-10 w-auto" onerror="this.onerror=null; this.src='/images/IMG_7959.png'" />
              <div>
                <span class="block font-serif text-lg font-bold text-sabeel-raspberry uppercase">Sabeel Institute</span>
                <span class="block text-xs text-sabeel-dark/80">Houston, Texas</span>
              </div>
            </a>
            <p class="text-sm text-sabeel-dark/80 leading-relaxed">
              Dedicated to nurturing hearts, minds, and souls through authentic Islamic education, spiritual development, and vibrant sisterhood in Houston and online.
            </p>
          </div>

          <!-- Col 2: Quick Links -->
          <div>
            <h4 class="font-serif font-bold text-sabeel-raspberry text-base tracking-wide uppercase mb-4">Quick Links</h4>
            <ul class="space-y-2.5 text-sm">
              <li><a href="about.html" class="hover:text-sabeel-raspberry transition">About Us</a></li>
              <li><a href="our-mission.html" class="hover:text-sabeel-raspberry transition">Our Mission</a></li>
              <li><a href="our-team.html" class="hover:text-sabeel-raspberry transition">Our Faculty & Staff</a></li>
              <li><a href="seminary.html" class="hover:text-sabeel-raspberry transition">Hikam Seminary</a></li>
              <li><a href="courses.html" class="hover:text-sabeel-raspberry transition">Current Courses</a></li>
              <li><a href="past-courses.html" class="hover:text-sabeel-raspberry transition">Past Programs</a></li>
            </ul>
          </div>

          <!-- Col 3: Resources -->
          <div>
            <h4 class="font-serif font-bold text-sabeel-raspberry text-base tracking-wide uppercase mb-4">Resources</h4>
            <ul class="space-y-2.5 text-sm">
              <li><a href="financial-aid.html" class="hover:text-sabeel-raspberry transition">Financial Aid Application</a></li>
              <li><a href="donate.html" class="hover:text-sabeel-raspberry transition">Support & Donations</a></li>
              <li><a href="testimonials.html" class="hover:text-sabeel-raspberry transition">Student Testimonials</a></li>
              <li><a href="blog.html" class="hover:text-sabeel-raspberry transition">Articles & Updates</a></li>
              <li><a href="contact.html" class="hover:text-sabeel-raspberry transition">Get in Touch</a></li>
            </ul>
          </div>

          <!-- Col 4: Contact Information -->
          <div>
            <h4 class="font-serif font-bold text-sabeel-raspberry text-base tracking-wide uppercase mb-4">Contact Us</h4>
            <ul class="space-y-3 text-sm">
              <li class="flex items-start gap-3">
                <svg class="w-5 h-5 text-sabeel-raspberry mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                <span>info@oursabeel.com</span>
              </li>
              <li class="flex items-start gap-3">
                <svg class="w-5 h-5 text-sabeel-raspberry mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <span>Serving communities across Houston, Texas and Online</span>
              </li>
            </ul>
          </div>

        </div>

        <div class="mt-12 pt-8 border-t border-sabeel-raspberry/20 flex flex-col md:flex-row justify-between items-center text-xs text-sabeel-dark/70 gap-4">
          <div>
            &copy; ${new Date().getFullYear()} Sabeel Institute. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
});
