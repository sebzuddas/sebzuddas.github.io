# Operations

## Build & Deployment

### Local Development

**Start Development Server:**
```bash
bash tools/run
# or
bundle exec jekyll serve
```
Server runs at: http://127.0.0.1:4000

**Watch JavaScript (during development):**
```bash
npm run watch:js
```

### Build Process

**1. Frontend Assets:**
```bash
# Build JavaScript bundles
npm run build:js

# Build optimized CSS
npm run build:css
```

**2. Jekyll Site:**
```bash
# Production build
JEKYLL_ENV=production bundle exec jekyll build

# Output: _site/
```

**3. Test Build:**
```bash
bash tools/test
# Runs htmlproofer validation
```

### Deployment Pipeline

**Platform:** GitHub Pages
**Workflow:** `.github/workflows/pages-deploy.yml`

**Trigger:** Push to `master` branch

**Steps:**
1. Checkout repository
2. Setup Ruby 3.3 environment
3. Install dependencies (cached)
4. Build site: `bundle exec jekyll b`
5. Validate with htmlproofer
6. Upload artifact
7. Deploy to GitHub Pages

**URL:** https://sebzuddas.com

### Asset Pipeline

**JavaScript:**
- Source: `_javascript/`
- Bundler: Rollup
- Transpiler: Babel
- Minifier: Terser
- Output: `assets/js/dist/*.min.js`
- Entry points: commons, home, categories, page, post, misc, PWA (app, sw)

**CSS:**
- SCSS Source: `_sass/`
- Bootstrap: Optimized via PurgeCSS
- Compiled by Jekyll
- Output: `assets/css/`

**Images:**
- Location: `assets/img/`
- Manual optimization required
- Served via GitHub Pages CDN

---

## Development Workflow

### Branch Strategy
- **Main Branch:** `master` (production)
- **Current Working Branch:** `claude-edit`
- Push to `master` triggers deployment

### Content Creation

**New Post:**
```bash
bundle exec jekyll compose "Post Title"
# Creates: _posts/YYYY-MM-DD-post-title.md
```

**New Draft:**
```bash
bundle exec jekyll compose "Draft Title" --draft
# Creates: _drafts/draft-title.md
```

**Publish Draft:**
```bash
bundle exec jekyll publish _drafts/draft-title.md
# Moves to _posts/ with date prefix
```

### Git Workflow

**Commit Convention:** Conventional Commits (enforced by Husky)
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Testing
- `chore:` Maintenance

**Example:**
```bash
git commit -m "feat: add new post on systems thinking"
```

### Dependencies

**Update Ruby Gems:**
```bash
bundle update
```

**Update Node Packages:**
```bash
npm update
```

**Check for Outdated:**
```bash
bundle outdated
npm outdated
```

---

## Maintenance

### Regular Tasks

**Content:**
- Review and publish drafts from `_drafts/` (currently 14 pending)
- Update About page and other tabs
- Maintain image assets

**Technical:**
- Update dependencies monthly (Jekyll, theme, npm packages)
- Review Google Analytics insights
- Monitor build performance
- Check broken links (htmlproofer runs on deploy)

**SEO:**
- Update meta descriptions
- Review sitemap.xml generation
- Maintain robots.txt
- Monitor search rankings

### Monitoring

**Analytics:** Google Analytics (G-4GKWLFQBB8)
- Track page views, user behavior
- Monitor bounce rates
- Analyze traffic sources

**Performance:**
- GitHub Actions build logs
- Lighthouse scores (manual checks)
- Core Web Vitals

**Uptime:**
- GitHub Pages status: https://www.githubstatus.com
- Domain status: sebzuddas.com

### Troubleshooting

**Build Failures:**
1. Check GitHub Actions logs
2. Test locally: `bundle exec jekyll build`
3. Validate with: `bash tools/test`

**JavaScript Issues:**
1. Rebuild: `npm run build:js`
2. Check console errors
3. Review Rollup config: `rollup.config.js`

**Style Issues:**
1. Rebuild CSS: `npm run build:css`
2. Check SCSS compilation
3. Review PurgeCSS config: `purgecss.config.js`

**Dependency Conflicts:**
1. Clear bundler cache: `bundle clean --force`
2. Clear npm cache: `npm cache clean --force`
3. Reinstall: `bundle install && npm install`

### Backup Strategy

**Git Repository:**
- Source of truth: GitHub remote
- All content version-controlled
- Branch protection on `master`

**Configuration:**
- `_config.yml` - Jekyll settings
- `Gemfile` - Ruby dependencies
- `package.json` - Node dependencies
- All tracked in git

**Generated Content:**
- `_site/` excluded from git (generated on deploy)
- No database or external storage needed

---

## Key Files & Locations

**Configuration:**
- `_config.yml` - Main Jekyll config
- `rollup.config.js` - JS bundler config
- `purgecss.config.js` - CSS optimizer config
- `.github/workflows/pages-deploy.yml` - CI/CD pipeline

**Content:**
- `_posts/` - Published posts (6)
- `_drafts/` - Draft posts (14)
- `_tabs/` - Navigation pages (10)
- `_data/` - Structured data (authors, projects, etc.)

**Templates:**
- `_layouts/` - Page layouts (16)
- `_includes/` - Reusable components (37)

**Assets:**
- `_javascript/` - JS source
- `_sass/` - SCSS source
- `assets/img/` - Images
- `assets/js/dist/` - Compiled JS
- `assets/css/` - Compiled CSS

**Tools:**
- `tools/init` - Initialize new site
- `tools/run` - Development server
- `tools/test` - Run tests
- `tools/release` - Release management

---
