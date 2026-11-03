# sebzuddas.com

Personal website, built with Astro and hosted on Vercel. Requires Node 22.23.4 or later.

    npm install
    npm run dev
    npm test                 # model tests
    npm run build
    npm run test:e2e         # acceptance tests, against the build

Add a tool by creating a folder in `src/tools/` with `meta.ts`, `model.ts`, `model.test.ts`, `view.ts`
and `notes.mdx`. Routes and listings pick it up automatically. Add a resource to
`src/content/resources/resources.json`, and hand-written project details to `src/content/projects/projects.json`.

Projects otherwise come from GitHub at build time: every public repo that is not a fork gets a page
built from its README. A repo's site is embedded if it allows framing and is more than a copy of the
README, and linked otherwise. To keep a repo off the site, add it to `hidden` in that file. A failed
GitHub read fails the build, which leaves the last good site live. Local builds keep the result in
`.cache/` for an hour, because anonymous reads are limited to 60 an hour.

`/writing/` lists the Substack feed, read at build time through `src/lib/providers/writing.ts`. A daily
rebuild keeps it fresh. Posts not yet on Substack stay unlisted at `/posts/<slug>/`. When one moves,
add it to `movedToSubstack` in `src/lib/posts.ts`.

Vercel builds and deploys every push to master. The `Checks` workflow runs the tests alongside, and
triggers a daily rebuild through the `VERCEL_DEPLOY_HOOK` secret. Repos with a GitHub Pages site are
served under this domain, such as `/grid_mpc/`, by rewrites in `vercel.json`. A new Pages repo needs a
line there too, and the build warns when one is missing.

Design rules and the hero's frozen specification are in `docs/plans/IMPLEMENTATION-REQUIREMENTS.md`.
