# Sabeel Institute website

Website for Sabeel Institute, an Islamic education non-profit for women in
Houston, TX. Built with Astro and Tailwind CSS; deployed to Firebase Hosting
from GitHub Actions.

```bash
npm ci
npm run dev      # http://localhost:4321
npm run build    # validates content and builds to dist/
```

Programs, team bios, milestones, and testimonials are Markdown/YAML files in
`src/content/`; photos go in `src/assets/photos/`. See [AGENTS.md](AGENTS.md)
for how to add or update them, how bespoke program pages work, and the design
rules.
