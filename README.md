# Sabeel Institute website

Website for Sabeel Institute, an Islamic education non-profit for women in
Houston, TX. Built with Astro and Tailwind CSS; deployed to Firebase Hosting
from GitHub Actions.

```bash
npm ci
npm run dev      # http://localhost:4321
npm run build    # validates content and builds to dist/
```

Programs, team bios, and testimonials are Markdown/YAML files in
`src/content/`; photos go in `src/assets/photos/`. See [AGENTS.md](AGENTS.md)
for how to add or update them, how bespoke program pages work, and the design
rules, and [docs/deployment.md](docs/deployment.md) for how deploys work and
how to set them up or move them. Every pull request gets a preview and a
visual comparison with `main`, linked in a comment on the pull request.

Staff who ask an agent for changes can see everything a program's page and
card can show in [docs/course-guide.md](docs/course-guide.md).
