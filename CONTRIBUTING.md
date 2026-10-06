# Contributing to BeanFinder

For a missing roaster or incorrect listing, use the [recommendation/correction form](https://beanfinder.coffee/submit/) or [open an issue](https://github.com/xdaybreakerx/beanfinder.coffee/issues). Names, websites and submitted notes become public in review PRs; keep private information out of them.

## Local setup

Clone the repository and use the pinned Node version from its root:

```sh
nvm install
nvm use
cd app
npm ci
cp .env.example .env
npm run dev
```

The development server uses <http://localhost:4321>. The directory works without Maps credentials; placeholder keys cannot load a live map. Keep `.env` and secrets out of Git.

| Variable | Purpose |
| --- | --- |
| `GOOGLE_MAPS_API_KEY` | Browser key for Maps and Places API (New), restricted to permitted website referrers. Local/preview origins must be permitted for live map checks. This key is sent to the browser. |
| `GOOGLE_PLACES_SERVER_API_KEY` | Separate API-restricted server key for the production coordinate worker. Do not expose it to the browser. |
| `PLACE_COORDINATES_MONTHLY_LIMIT` | Production worker attempt allowance per UTC month, capped at 1000; missing, invalid or zero disables new retrievals. |
| `FORM_PR_GITHUB_TOKEN` | Production Functions token for reviewed form PRs. Ordinary development and fixture tests do not require it. |
| `DEV_SITE_URL` | Optional development origin for generated metadata when using a different port. Browser tests set their own origin. |

Do not copy production secrets into test fixtures or PR descriptions. Coordinate reads/refresh/purge are production-only; deploy previews do not share production runtime coordinates. See [operations](docs/operations.md) for deployment scopes, token recovery, schedules and usage controls.

## Checks

Run commands from `app/`:

| Command | Checks |
| --- | --- |
| `npm run validate:data` | Business/location identities, websites, classification, sources and references |
| `npm run validate:release` | Matching stable package/lockfile roots; next-patch rules for form PRs in CI |
| `npm run check` | Astro type generation and TypeScript |
| `npm test` | Directory, map and form/recovery unit tests |
| `npm run build` | Data validation and the production Netlify build |
| `npm run test:e2e` | Desktop/mobile flows, keyboard behavior, responsive layouts and automated accessibility |

Before the first browser run, install its browser with `npx playwright install chromium`. Browser tests launch an isolated local server on port 48765 and intercept form submissions; do not submit production forms as test data. Maps fixtures cover failures, limits and location-denial behavior. Live Google Maps, actual Safari/iOS and assistive technology need separate manual checks when their behavior changes.

## Project layout

```text
app/
  src/components/     Astro and React UI
  src/data/           Curated directory, reviewed places and legacy manifests
  src/hooks/          Browser map behavior
  src/layouts/        Shared layout and route metadata
  src/pages/          Public pages, directories and legacy redirects
  src/scripts/        Validation and maintainer recovery tools
  src/server/         Form proposals, release helpers and coordinate storage
  netlify/functions/  Form events, coordinate reads, refresh and purge
  public/             Static assets and Netlify form-detection file
  tests/e2e/          Browser and accessibility checks
docs/                 Data review and contribution operations
```

## Directory changes

Read the [data review guide](docs/directory-data.md) before editing JSON. Preserve immutable business/location IDs and website aliases through renames and reclassification. Validate normalized website uniqueness and Australian state/country matching. Record source/provenance honestly; proposal time is not independent verification.

Review branch identity and cafe access against operator information or independent submissions. Address-only branches can appear in the directory without a marker; only confirmed place IDs enter coordinate refresh. Do not invent scores, review counts, coordinates or historical retrieval dates. The accepted legacy snapshot stays separate from reviewed business facts and newly retrieved temporary coordinates.

The public form creates a `forms/<submission-id>` PR rather than editing main. Review duplicate proposals, identity matches, classification, notes, sources and conflicts before merging. Receipts contain whitelisted public fields. [Operations](docs/operations.md) documents replay/backfill commands and partial-failure recovery; keep raw form exports outside the repository.

## Pull requests and versions

Use a focused branch based on current main. Describe the resulting behavior and relevant validation; check both themes and narrow layouts for visible changes. Keep credentials, raw provider responses, private submissions and generated build/test artifacts out of commits.

Main requires a reviewed PR and the `verify` check against current main. CI installs the lockfile and runs data/release validation, TypeScript, unit tests, build and desktop/mobile browser tests. Netlify supplies a deploy preview for hosted checks.

App major/minor releases are chosen manually. Data changes increment only the patch: after `2.0.0`, the next data PR proposes `2.0.1`. Update these three roots together:

- `app/package.json` → `version`
- `app/package-lock.json` → `version`
- `app/package-lock.json` → `packages[""].version`

From `app/`, `npm version 2.0.0 --no-git-tag-version --ignore-scripts` selects an explicit release without creating a tag. This command does not update dependencies. Form automation reads current main and prepares the next patch atomically with its data/receipt; duplicates and explanation-only corrections do not bump. If main advances while a data PR is open, reconcile its data and versions to the next patch after main and rerun CI.

Release publication is manual. After an approved merge, verify the production deployment and final main CI, review pending form-PR versions, then publish the matching `vX.Y.Z` tag/GitHub release when authorized. Runtime coordinate refreshes never change Git or release versions. See [operations](docs/operations.md#release-versioning).
