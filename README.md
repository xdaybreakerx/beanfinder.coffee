# ☕️ BeanFinder.coffee

A curated directory of Australian coffee roasters, cafes and multi-roaster sellers. Find your next bag of beans, a nearby coffee stop or a subscription worth exploring.

It started as a spreadsheet of roasters I wanted to try, then became an excuse to learn Astro and build something useful for fellow coffee drinkers.

**[Visit BeanFinder](https://beanfinder.coffee)** · [Suggest a roaster or correction](https://beanfinder.coffee/submit/) · [Contributing](CONTRIBUTING.md)

## What's brewing

- **Find a roaster:** search by name or location, filter by state and cafe availability, and sort alphabetically or by Google rating. Bookmark or share your filtered results.
- **Explore nearby:** browse the map, search a location or use your own, then get directions to a cafe or roaster.
- **Compare subscriptions:** browse multi-roaster sellers by subscription availability, coffee selection and brew options.
- **Make yourself comfortable:** light and dark themes, responsive layouts, keyboard navigation and previews for shared links.
- **Help the directory grow:** suggest a roaster or correction through the site. Submissions become reviewable GitHub PRs.

## Built with

Astro handles the pages, with React for interactive components and curated JSON for the directory. Data changes are reviewed in Git alongside the code.

| Layer | Tools |
| --- | --- |
| App | Astro, React, TypeScript |
| Styling | Tailwind CSS, daisyUI |
| Maps | Google Maps and Places |
| Hosting | Netlify, Functions and Blobs |
| Testing | Vitest, Playwright, axe-core |

## Run locally

Clone the repository, then use the Node version pinned in `.nvmrc`:

```sh
nvm install
nvm use
cd app
npm ci
cp .env.example .env
npm run dev
```

Open <http://localhost:4321>. To enable the map locally, add your Google Maps browser key to `.env`; [CONTRIBUTING](CONTRIBUTING.md#local-setup) covers the environment setup. You can explore the directory without a key.

From `app/`, use `npm run check` for TypeScript, `npm test` for unit tests and `npm run build` for a production build. The contributing guide includes data validation and browser test commands.

## Contributing

Found a missing roaster, spotted a bug or have an improvement in mind? Contributions are welcome.

Use the [suggestion form](https://beanfinder.coffee/submit/) for listings, or [open an issue](https://github.com/xdaybreakerx/beanfinder.coffee/issues) to discuss an idea. See [CONTRIBUTING](CONTRIBUTING.md) for the project layout, checks and PR workflow.

## License

[MIT](LICENSE).
