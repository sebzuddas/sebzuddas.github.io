# Architecture

## Overview

**Type:** Static site generator (Jekyll)
**Theme:** Chirpy v7.0.1
**Platform:** GitHub Pages
**URL:** https://sebzuddas.com

---

## Technology Stack

### Core
- **Jekyll** ~4.3 - Static site generator (Ruby)
- **Chirpy Theme** 7.0.1 - Modern blog theme
- **Ruby** 3.3 - Runtime environment
- **Node.js** - Frontend tooling

### Frontend
- **Bootstrap** 5.3.3 - CSS framework
- **Popper.js** - Tooltip/popover positioning
- **Rollup** - JavaScript bundler
- **Babel** - JavaScript transpiler
- **PurgeCSS** - CSS optimization

### Jekyll Plugins
- `jekyll-paginate` - Post pagination
- `jekyll-redirect-from` - URL redirects
- `jekyll-seo-tag` - SEO meta tags
- `jekyll-archives` - Category/tag archives
- `jekyll-sitemap` - Sitemap generation
- `jekyll-include-cache` - Performance optimization
- `jekyll-feed` - RSS/Atom feeds
- `jekyll-compose` - Content creation helpers

### Development Tools
- **HTMLProofer** - HTML validation
- **Stylelint** - CSS linting
- **Husky** - Git hooks
- **Commitlint** - Commit message linting
- **Semantic Release** - Version management

---

## Architecture Patterns

### Static Site Generation
Jekyll transforms Markdown content and Liquid templates into static HTML at build time.

**Flow:**
```
Content (Markdown) + Templates (Liquid) + Data (YAML)
         ↓
    Jekyll Build
         ↓
   Static HTML/CSS/JS (_site/)
         ↓
   GitHub Pages (CDN)
```

### Content Organization
- **Posts:** Date-based blog content (`_posts/YYYY-MM-DD-title.md`)
- **Drafts:** Unpublished content (`_drafts/title.md`)
- **Pages:** Static navigation pages (`_tabs/`)
- **Collections:** Reusable content sets (configured in `_config.yml`)

### Template Hierarchy
```
_layouts/default.html (base)
    ↓
_layouts/home.html (homepage)
_layouts/post.html (blog posts)
_layouts/page.html (static pages)
_layouts/[custom].html (books, projects, wiki, etc.)
    ↓
_includes/ (reusable components)
```

### Asset Pipeline

**JavaScript:**
```
_javascript/*.js (source)
    ↓
Rollup (bundle)
    ↓
Babel (transpile)
    ↓
Terser (minify)
    ↓
assets/js/dist/*.min.js
```

**CSS:**
```
_sass/*.scss (source) + node_modules/bootstrap/
    ↓
PurgeCSS (remove unused)
    ↓
Jekyll/Sass (compile)
    ↓
assets/css/*.css (compressed)
```

---

## Directory Structure

```
/
├── _config.yml              # Jekyll configuration
├── index.html               # Homepage
├── Gemfile                  # Ruby dependencies
├── package.json             # Node dependencies
│
├── _posts/                  # Published blog posts
├── _drafts/                 # Draft posts
├── _tabs/                   # Navigation pages
│
├── _layouts/                # Page templates
├── _includes/               # Reusable HTML components
├── _data/                   # Structured data (YAML/JSON)
│   ├── authors.yml
│   ├── contact.yml
│   ├── projects.yml
│   ├── share.yml
│   ├── media.yml
│   └── locales/            # i18n translations
│
├── _javascript/             # JS source files
│   ├── commons.js
│   ├── home.js
│   ├── post.js
│   ├── modules/            # Shared modules
│   └── pwa/                # Progressive Web App
│
├── _sass/                   # SCSS source files
│   ├── main.scss
│   ├── addon/
│   ├── colors/
│   └── layout/
│
├── assets/
│   ├── css/                # Compiled CSS
│   ├── js/
│   │   ├── dist/          # Compiled/minified JS
│   │   └── data/          # JS data files
│   └── img/               # Images
│
├── _plugins/               # Custom Ruby plugins
├── tools/                  # Build/deployment scripts
├── .github/
│   └── workflows/          # CI/CD pipelines
└── docs/                   # Project documentation
```

---

## Key Components

### Progressive Web App (PWA)
- Service worker for offline support
- App manifest for installability
- Cache-first strategy for assets
- Network-first for content

**Files:**
- `_javascript/pwa/app.js` - PWA initialization
- `_javascript/pwa/sw.js` - Service worker
- `assets/js/dist/app.min.js` - Compiled PWA

### Search Functionality
- Client-side search
- Indexes post titles, content, tags, categories
- No external search service required

### Theme Toggle
- Light/dark mode switcher
- Preference stored in localStorage
- Respects system preferences (prefers-color-scheme)

### Table of Contents (TOC)
- Auto-generated from post headings
- Sticky sidebar navigation
- Smooth scroll to sections

### Syntax Highlighting
- **Engine:** Rouge (Ruby)
- **Styles:** Customizable via SCSS
- Supports 100+ languages
- Line numbers, highlighting, filename labels

### Math Rendering
- **Engine:** MathJax or KaTeX
- Enabled per-post via front matter: `math: true`
- LaTeX syntax support

### Diagrams
- **Engine:** Mermaid
- Enabled per-post: `mermaid: true`
- Flowcharts, sequence diagrams, Gantt charts, etc.

---

## Data Flow

### Build-Time Data
1. **Configuration:** `_config.yml` loaded
2. **Data Files:** `_data/` parsed (YAML/JSON)
3. **Content:** Markdown files processed
4. **Templates:** Liquid templates rendered
5. **Assets:** SCSS compiled, JS bundled
6. **Output:** Static HTML in `_site/`

### Runtime (Client-Side)
1. User requests page
2. GitHub Pages CDN serves static HTML
3. Browser loads CSS/JS assets
4. JavaScript initializes:
   - PWA service worker
   - Theme toggle
   - Search index
   - TOC navigation
   - Lazy loading
5. Interactive features enabled

---

## Performance Considerations

### Optimization Strategies
- **PurgeCSS:** Removes unused Bootstrap CSS
- **Minification:** JS/CSS minified in production
- **Caching:** Service worker caches assets
- **Lazy Loading:** Images loaded on demand
- **Pagination:** Posts paginated (10 per page)
- **CDN:** GitHub Pages global CDN

### Build Performance
- **Include Cache:** Plugin caches partial renders
- **Incremental Build:** Jekyll watches file changes
- **Parallel Processing:** Rollup concurrent builds

---

## Security

### Static Site Benefits
- No server-side code execution
- No database vulnerabilities
- No authentication/session management
- XSS protection via static content

### Git Hooks
- **Husky:** Pre-commit validation
- **Commitlint:** Conventional commit enforcement
- Prevents malformed commits

### CI/CD Validation
- **HTMLProofer:** Validates HTML structure
- Checks for broken links
- Validates images, scripts, accessibility

---

## Extensibility

### Adding Custom Features

**New Tab/Page:**
1. Create file in `_tabs/`
2. Add front matter with layout
3. Auto-appears in navigation

**Custom Layout:**
1. Create file in `_layouts/`
2. Extend default layout
3. Reference in page front matter

**Data-Driven Content:**
1. Add YAML file to `_data/`
2. Access via `site.data.filename`
3. Iterate in templates with Liquid

**Custom JavaScript:**
1. Add module to `_javascript/modules/`
2. Import in relevant entry point
3. Rebuild: `npm run build:js`

**Custom Styles:**
1. Add SCSS file to `_sass/`
2. Import in `_sass/main.scss`
3. Rebuilt automatically by Jekyll

---

## Third-Party Integrations

### Analytics
- **Google Analytics 4:** G-4GKWLFQBB8
- Configured in `_config.yml`
- Included via `_includes/google-analytics.html`

### Comments (Optional)
- Disqus, Utterances, Giscus support
- Configured per-post via front matter
- Disabled by default

### Social Sharing
- Pre-configured share buttons
- Twitter, Facebook, LinkedIn, Telegram
- Defined in `_data/share.yml`

### Newsletter (Custom)
- Custom include: `_includes/newsletter.html`
- Integration method TBD

---

## Deployment Architecture

### GitHub Pages
- **Source:** `master` branch
- **Build:** GitHub Actions workflow
- **Hosting:** GitHub's CDN
- **SSL:** Automatic HTTPS
- **Custom Domain:** sebzuddas.com

### CI/CD Pipeline
```
Git Push (master)
    ↓
GitHub Actions Trigger
    ↓
Setup Environment (Ruby 3.3)
    ↓
Install Dependencies (cached)
    ↓
Build Site (Jekyll)
    ↓
Validate (HTMLProofer)
    ↓
Upload Artifact
    ↓
Deploy to GitHub Pages
    ↓
Live at sebzuddas.com
```

### Rollback Strategy
- Git revert commit
- Push to `master`
- Automatic rebuild/redeploy
- Previous version restored

---

## Browser Support

### Targets
- Modern evergreen browsers
- Chrome, Firefox, Safari, Edge (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

### Polyfills
- Babel transpiles ES6+ to ES5
- Core-js for modern API support
- Configured in Rollup

### Progressive Enhancement
- Core content accessible without JavaScript
- Enhanced features layer on top
- Graceful degradation for older browsers

---

## Internationalization (i18n)

### Locales
- 26 locale files in `_data/locales/`
- English default: `en.yml`
- UI strings translated
- Content remains English (primary audience)

### Adding New Language
1. Create `_data/locales/[lang].yml`
2. Translate UI strings
3. Set `lang` in `_config.yml` or front matter
4. Chirpy theme handles rendering

---

## Monitoring & Observability

### Build Monitoring
- GitHub Actions logs
- Build success/failure notifications
- Deployment status visible in repo

### Analytics
- Google Analytics dashboard
- Traffic, engagement, conversions
- Custom events tracking available

### Error Tracking
- Client-side errors: Browser console
- Build errors: GitHub Actions logs
- Link validation: HTMLProofer reports

### Performance Monitoring
- Lighthouse CI (manual)
- Core Web Vitals (Google Search Console)
- GitHub Pages doesn't provide server logs

---

## Future Considerations

### Potential Improvements
- Automated Lighthouse CI in workflow
- Image optimization pipeline (imagemin)
- Advanced caching strategies
- RSS feed customization
- Newsletter automation
- Comment system integration
- Enhanced PWA features (push notifications)

### Scalability
- Static site scales infinitely on CDN
- No server capacity concerns
- Build time increases with content volume
- Consider Jekyll alternatives (Hugo, Eleventy) if build time becomes issue

---
