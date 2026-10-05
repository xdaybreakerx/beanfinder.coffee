# BeanFinder v2 release and portfolio readiness

Assessed 5 October 2026 against `main` commit [`7ae6e7d`](https://github.com/xdaybreakerx/beanfinder.coffee/commit/7ae6e7d6e12c20843da6c49836f821256513118f), after the approved squash merge of [PR #15](https://github.com/xdaybreakerx/beanfinder.coffee/pull/15). Both its runner verification and the subsequent main verification passed. This is an assessment and proposed release plan; the package remains `1.1.0`.

## Recommendation

The refreshed directory is a strong portfolio foundation. It now has searchable rows, shareable filters, readable light/dark themes, Australian map filtering, and reviewed form-to-PR automation. A framework rewrite or another broad dependency upgrade would add little value.

Before presenting it as a finished v2, prioritize data integrity, the weekly update workflow, Maps/Places modernization, map loading and location-permission behavior, accessible names, and Google data/privacy requirements. Then reconcile the portfolio documentation and publish a versioned release with fresh screenshots and measured results. Small user conveniences can follow without delaying that release.

Priority below means **P1: address before the v2 announcement**, **P2: useful polish or a documented follow-up**, and **QOL: optional product improvement**. These are release recommendations, not claims that every finding currently breaks the site.

## Verified baseline

| Area | Result |
| --- | --- |
| Code and deployment | PR #15 squash-merged; runner CI and main CI succeeded; production serves the refreshed pages |
| Tests | 87 unit tests and 60 desktop/mobile browser tests, including separate accessibility scans for seven routes in both themes |
| Data | 242 listing records: 234 classified as roasters and 8 as multi-roaster sellers; 147 records have a cafe flag |
| Map cache | 216 roaster records, 222 cached locations, 218 unique valid Australian marker IDs |
| Cafe locality coverage | 133 of 147 cafe listings have an exact-website match to a saved Australian location; 14 use the labelled Google Maps search fallback |
| Versions | Package, lockfile, and lockfile root all read `1.1.0`; the only published GitHub release is still `v1.0.0` from August 2024 |
| Dependencies | All direct packages match npm's latest release except `@netlify/functions` (`5.3.0`, latest `6.0.2`, a major upgrade) |
| Scheduled enrichment | Last eight scheduled runs succeeded; the latest ran before today's Node, forms, data, and UI changes |
| Open project work | No open GitHub issues; draft documentation [PR #10](https://github.com/xdaybreakerx/beanfinder.coffee/pull/10) remains open and conflicts with main |

Counts describe listing records, not verified unique businesses. The duplicates described below inflate the headline count.

### Fresh production Lighthouse baseline

Lighthouse **13.5.0**, Chromium from Playwright **1.63.0**, single navigation runs on 5 October 2026, default simulated mobile throttling or the desktop preset, light theme, production `https://beanfinder.coffee/`. These are lab observations from this machine, not field Core Web Vitals or a complete accessibility assessment.

| Page/device | Performance | Accessibility | Best practices | SEO | LCP | CLS | Total blocking time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Homepage, mobile | 99 | 100 | 100 | 100 | 1.3 s | 0 | 80 ms |
| Homepage, desktop | 100 | 100 | 100 | 100 | 0.3 s | 0 | 0 ms |
| Directory, mobile | 92 | 100 | 100 | 100 | 3.2 s | 0 | 70 ms |
| Map, mobile | 61 | 100 | 96 | 100 | 6.4 s | 0.194 | 310 ms |

The reports also flag an experimental accessible-name audit despite the displayed accessibility score of 100. Preserve that distinction in a case study. The old root `lighthouse-score.png` is a historical capture, not evidence for this release. Raw audit files remain outside the repository because map network records can contain the browser API key.

## Maps API: current runtime, legacy search services

| Integration | Current implementation | Assessment and next action |
| --- | --- | --- |
| Maps JavaScript runtime | [`googleMapsLoader.js`](../app/src/utils/googleMapsLoader.js) requests `v: "beta"`; production reports **3.66.7-beta** | It automatically follows a current channel, rather than being pinned to an old numbered version. Prefer `weekly` for production after regression testing. Google's current weekly channel is 3.66 and quarterly is 3.65. |
| Location autocomplete | [`ReactGoogleMap.tsx`](../app/src/components/ReactGoogleMap.tsx) constructs `google.maps.places.Autocomplete` and consumes `PlaceResult.geometry` | This is the legacy widget. Migrate to `PlaceAutocompleteElement`, restrict to Australia with the new widget's region controls, and request only the needed `Place` fields after selection. Adapt map centering to `location`/`viewport`. |
| Server enrichment | [`google-places.mjs`](../app/src/scripts/google-places.mjs) calls `/maps/api/place/findplacefromtext/json` and `/details/json` | These are Places API Legacy endpoints. Replace Find Place with **Text Search (New)** and details with **Place Details (New)**, using explicit field masks and the new response shape. Enable Places API (New) and confirm billing/key restrictions first. |
| Markers | `AdvancedMarkerElement`, DOM `gmp-click`, explicit Enter/Space handling | The application uses the current marker class and correct DOM event binding. Retest keyboard activation and cluster behavior when changing channels. |
| Place details UI | `@googlemaps/extended-component-library` **0.7.0** | npm-current; upstream repository is active, not archived. Its installed implementation uses `Place.fetchFields()` with a legacy fallback. Retain it unless a replacement has a clear benefit. Google's newer Places UI Kit is currently experimental, so it is not an automatic stability upgrade. |
| Clustering | `@googlemaps/markerclusterer` **2.6.2** | npm-current. It still uses `addListener()` on generated advanced cluster markers, producing a deprecation warning. Live pointer activation nevertheless zoomed from 3 to 8 on both beta and weekly. Track an upstream fix or provide a compatible renderer/event binding if needed. |

A browser-only interception of the production Maps loader to `v=weekly` successfully loaded **3.66.7**, cluster activation, geolocation centering, an individual marker, and place overview/directions. This is encouraging migration evidence, not a permanent configuration change or complete stable-channel sign-off.

Google marks Places Legacy services as legacy from March 2025; existing integrations can still work. The observed browser warning specifically says the old autocomplete widget is unavailable to new customers and recommends its replacement. Updating npm packages alone does not migrate these services. See [Google versioning](https://developers.google.com/maps/documentation/javascript/versions), [legacy service status](https://developers.google.com/maps/legacy), [autocomplete migration](https://developers.google.com/maps/documentation/javascript/legacy/places-migration-autocomplete), [Places migration overview](https://developers.google.com/maps/documentation/places/web-service/legacy/migrate-overview), and [Places UI Kit status](https://developers.google.com/maps/documentation/javascript/places-ui-kit/overview).

## P1: release preparation

### 1. Reconcile the directory and map data

[`coffee-roasters.json`](../app/src/data/coffee-roasters.json) contains exact duplicate records for **Bear Bones** and **Cherry Pickers Coffee**. **Coffee in Common** appears twice for the same normalized website, once for VIC and once for SA. Review the latter's actual locations and consolidate its state list if it represents one business. The form proposal code rejects multiple matches rather than guessing, so these records can also prevent corrections from being proposed.

Introduce a shared normalized website identity and a small data validation check for duplicate businesses, valid state sets, URLs, booleans, and seller classification. Make directory display, enrichment, cafe links, and form matching use the same identity. `getCafeMapLinks()` currently uses exact website equality and the first matching cache record, which can miss or fragment locations after a URL correction or multi-state split.

**Acuratore** is classified as a seller but remains in the regular-roaster file with `State: "VIC"`. It consequently contributes to VIC counts/state pages and is sent through regular-roaster enrichment, even though the UI presents sellers as online services. Move it to the seller collection and normalize online seller region semantics without losing any independently verified physical location data.

The 14 cafes without a saved valid location are **Beat Coffee, Bench Coffee Co, Core Roasters, First Love Coffee, Four Kilo Fish, Klim Coffee Roasting Co, Leaping Goat Coffee, Project 281, Red Bean Coffee Roasters, Siboni's Coffee, The Flour, Tone Coffee Roasters, Fieldwork Coffee, and Path Melbourne**. They remain discoverable in the directory, with map-search links. Review their locations and enrich the corrected/new records after fixing the update process; missing coordinates should remain explicit rather than inferred.

The map currently includes **71 unique marker IDs associated with cached records whose cafe flag is false**. The homepage link says “Find a cafe on the map,” but the map does not distinguish a public cafe from a roastery, warehouse, or shop. Join markers to the current directory, add a cafe-only filter or explicit location-type labels, and avoid promising a cafe at every marker.

All 222 cached locations still rely on the legacy formatted-address country check; none yet has the new `countryCode: "AU"` field. The Australia guard is active, but the new country-component enrichment has not been exercised across production data. Verify a reviewed refresh, including candidate identity, state, cafe access, and multiple branches. Finding an Australian address alone does not establish that it is the right business. Current search takes only one candidate per roaster/state and cannot comprehensively enumerate all branches.

### 2. Make enrichment compatible with repository protection

[`update-data.yml`](../.github/workflows/update-data.yml) writes generated files and pushes directly to its checked-out branch. The active **“prevent push to main”** ruleset requires a PR and lists no bypass actors. The next scheduled refresh is therefore expected to conflict with current protection; the earlier successful runs do not validate the new configuration.

Change enrichment to produce or update a review branch/PR. Skip clean diffs successfully, stage only the intended files, serialize concurrent refreshes, validate generated data before committing, and make both generated datasets coherent if the second phase fails. Today a first-phase success can overwrite its file locally before a second-phase error, though the failed workflow stops before committing. Reuse verified place IDs and refresh only necessary details where appropriate, instead of rediscovering every record each week; omit unused rating fields to avoid unnecessary requests/field charges.

Choose a GitHub App or appropriately scoped token for automatic PR checks, or deliberately handle approval of workflow-created PR runs. Current [GitHub token behavior](https://docs.github.com/en/actions/concepts/security/github_token) suppresses follow-on push runs and places certain token-created PR runs in an approval-required state. The repository currently disallows Actions creating/approving PRs through its default token setting. Do not assume changing `git push` to PR creation alone makes the workflow work.

The active ruleset has no required status-check rule. Require the existing `verify` check before merge. Narrow default workflow permissions from repository-wide write to read, with explicit writes only for the updater. Add a small maintainer-visible failure summary for enrichment and form ingestion, and document token expiry/replay recovery. The existing production-only event function, strict public-field validation, receipt deduplication, and manual review model are good foundations.

### 3. Complete the Maps modernization and account checks

Move production to stable `weekly`, migrate legacy autocomplete and server Places endpoints, and verify new field masks, Australian results, keyboard use, denial/failure behavior, and details/directions on the deployed site. Keep loader configuration consistent with `APIProvider`.

The same variable name, `GOOGLE_MAPS_API_KEY`, is currently used for browser rendering and server enrichment. A browser Maps key is necessarily visible in client requests; server-side secret retrieval does not make it private. Use separate browser/referrer-restricted and server/API-restricted credentials. Confirm enabled APIs, production/preview referrers, quotas, and budget alerts in Google Cloud. These account settings were not inspected during this review.

### 4. Resolve Google data storage, attribution, and policy pages

The repository permanently stores Google-derived formatted addresses, coordinates, and ratings in generated JSON/Git history. The directory now displays those addresses/localities outside an embedded Google Map, with a text link but no adjacent provider attribution. Review that storage and display model against the applicable Google agreement before extending it or adding rating sorting.

[Google's Maps JavaScript policy](https://developers.google.com/maps/documentation/javascript/policies) identifies place IDs as exempt from caching restrictions and requires public terms/privacy information and appropriate attribution. The [Places policy](https://developers.google.com/maps/documentation/places/web-service/policies) also explains storage exceptions and display attribution. Keep independently curated business data separate from provider content, preserve source/provenance, and use an allowed expiring cache or on-demand details strategy for restricted provider fields. This is an implementation issue to resolve against the account's actual terms, rather than a legal conclusion about its agreement.

Production `/privacy` and `/terms` currently return 404, and the footer has neither link. Add concise pages covering Google Maps, Netlify submissions, analytics, and local theme storage, linked from relevant UI. The submission form already warns that listing details/notes may become public. Google Analytics currently loads on every page; document it and choose the appropriate tracking/consent behavior for the site's actual audience and account settings.

### 5. Improve map startup and permission handling

The map's mobile Lighthouse result is materially weaker than the directory. Its **0.194 CLS** is attributed to the footer shifting as the map is inserted. Reserve the map shell/loading area height before the React island hydrates, show a stable loading placeholder, and keep surrounding content in place. Reduce eagerly imported Maps libraries and defer nonessential place-overview code until a marker is selected.

[`useGeolocation.js`](../app/src/hooks/useGeolocation.js) immediately requests a position on mount. Add a **Use my location** action, a bounded request timeout, and a concise unavailable/denied state while keeping location search usable. This also resolves Lighthouse's immediate-geolocation best-practice finding. Add a server-rendered map fallback message/link: without JavaScript the map island has no status content, although the surrounding directory navigation remains available.

### 6. Fix accessible names and add manual coverage

Fresh Lighthouse scans flag **`label-content-name-mismatch`** on the brand link and homepage state links. Their `aria-label` values replace visible text that includes the brand subtitle or listing counts. Prefer the visible link text as the accessible name, or ensure the full meaningful visible wording is retained. Verify voice-control and screen-reader use rather than relying on a score of 100; the flagged audit is experimental and is not caught by the current default axe run.

Retain the passing theme contrast, skip link, keyboard navigation, and reduced-motion support. Before the portfolio announcement, perform a short manual pass in Safari/iOS as well as Chromium: form errors, autocomplete suggestions, clustered/unclustered markers, details focus, zoom/fullscreen, 200–400% zoom, and both themes. Current mobile automated tests emulate iPhone dimensions in Chromium; they do not run Safari. The map unit tests mock Google and the full browser suite does not load and exercise the real Google map.

### 7. Keep preview navigation and release checks trustworthy

State pagination builds absolute URLs from production `SITE`. On the deploy preview, “Next” points to `https://www.beanfinder.coffee/roasters/VIC/false/2`, leaving the preview and potentially showing a different dataset/version. Use relative pagination URLs, as seller pagination already does, and verify this on an actual production-mode preview rather than only the development server.

Keep the current stable version while preparing v2 so form PR patch bumps remain functional. At release time set **`2.0.0`** in package and both lockfile roots, check consistency in CI, and reconcile any pending data PRs with the new main version. Merge with green runner/preview checks, confirm production, then publish **`v2.0.0`** and release notes from that tested commit. Automated form PRs can subsequently propose `2.0.1`, `2.0.2`, etc. The existing helper supports this already; there is no release/tag publishing workflow. Decide and document whether generated map-data changes also receive a patch bump.

## P2: security, metadata, and maintenance polish

- **Dependency advisories:** npm reports **14 high-severity affected package nodes**, while GitHub lists **6 open advisories** affecting `node-forge`, `extract-zip`, `braces`, and `sharp`. These are different counts of the same dependency chains, not 20 separate issues. `npm explain` traces the affected versions through `@astrojs/netlify → @netlify/vite-plugin → @netlify/dev`; Astro's separate optional `sharp` is already `0.35.5`. Review build/dev exposure and any bundled runtime paths. Prefer upstream upgrades or compatibility-tested targeted changes; record any temporary accepted risk. `npm audit` suggests downgrading the adapter to `6.5.13`, so `npm audit fix --force` is not a suitable release step. Public production exploitability was not established. References: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [extract-zip](https://github.com/advisories/GHSA-jmr9-qjv8-65gv), [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [sharp](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c).
- **SEO/share metadata:** `Layout.astro` sets the homepage `og:url`, title, and description on every route and has no canonical link. Production redirects `www` to the apex domain, but `SITE`, sitemap entries, and state pagination use `www`. Standardize the canonical origin, provide route-specific titles/descriptions/Open Graph URLs, add `robots.txt` with the sitemap location, and exclude `/success/` and the static form-detection page from indexing. Missing `robots.txt` is not by itself a crawl failure; the live sitemap works. Review the OG image against the refreshed branding.
- **Static rendering:** Homepage and full directory use server output despite being derived entirely from repository data. Consider prerendering them to improve cache behavior and reduce function work. Keep dynamic handling only where it is needed. The directory's 92 mobile score is already reasonable; prioritize the map first.
- **Runtime clarity:** Node `26.10.0` is consistently pinned for builds/CI; Node 26 is currently a Current release, while Node 24 is LTS. [Netlify documents a Node 24 fallback](https://docs.netlify.com/build/functions/configuration/#nodejs-version-for-runtime) for unsupported build runtime versions. Document or explicitly configure the function runtime and add a small compatibility check when upgrading it. The Node 18 warning has been addressed in code; no need for another unrelated runtime migration now.
- **Maintenance hygiene:** Add scheduled dependency-update PRs and a concise contribution/data-review guide. README lists Prettier and ESLint, but neither tooling nor scripts are present. Either install/configure a modest formatter/linter or remove the claim. Review the unused `coffee-roasters-api-testing.json` fixture, duplicated derived datasets, stale card/SSG/monolithic-map narrative, and the `PlaceOverviewComponent` resize state that is calculated but ignored because `size="medium"` is hardcoded. On marker cleanup, detach the clusterer from the map as well as clearing markers so its idle listener is removed.

## Previously planned work: actual status

| Plan | Status | Recommended treatment |
| --- | --- | --- |
| Australia-only results | Implemented for map/cafe locations; new country-component enrichment still awaits a reviewed refresh | Verify the refreshed dataset and business matches |
| Directory/UI refresh, coffee/caramellatte pairing, favicon/focus improvements | Merged in #15 | Carry forward; fix remaining accessible names and map startup |
| Cafe suburb/map links | Implemented with saved locality links, searchable addresses, and explicit fallback searches | Improve coverage for the 14 unresolved cafes |
| Netlify submission auto PRs | Implemented and previously manually exercised | Keep review/idempotency safeguards; add expiry/failure visibility |
| Historical form backfill | Completed and merged in #14; Path classification corrected in #15 | Keep receipts for idempotency/audit history; the backfill command/review file is recovery tooling, not unfinished import work |
| README stretch item “Sort by rating or alphabetical” | Alphabetical ordering is already implemented; rating sorting is not | Correct the checklist. Defer ratings unless their user value, freshness, provider requirements, and request cost justify them |
| Portfolio README/case study | Draft #10 is unmerged, conflicted, and based on an old baseline | Rebase/rewrite around current behavior. Its stated dependency is publication/verification of the portfolio article linked from that PR. Preserve the new operational documentation rather than overwriting it |
| v2 release | Not prepared or published | Use the release sequence above; publish current screenshots and evidence after fixes |

The older draft README also describes card components, lacks the new Node/forms/versioning instructions, and says cafe-toggle wording needs review even though #15 fixed that wording. Its proposed `junosalathe.com/writing/beanfinder` article URL could not be verified: browser-source access failed and this environment's DNS lookup returned `ENOTFOUND`. Confirm the intended portfolio domain and publish/verify the article before linking it in public documentation.

## Small QOL features, ranked

| Feature | Benefit | Scope |
| --- | --- | --- |
| **Suggest a correction** on each row | Opens the existing form with name/current website prefilled, reducing user effort and ambiguous matches | Small; validate URL parameters and let users edit values |
| **Copy search link** | Makes the existing bookmarkable filters obvious and easy to share | Small; clipboard fallback and a brief accessible confirmation |
| **Use my location** and **cafe-only map** | Finds usable nearby coffee stops with an explicit permission request | Small/medium; also addresses release findings |
| **Return to system theme** | Lets visitors undo a saved light/dark choice without clearing browser storage | Small; existing controller already follows the system when no explicit choice is saved |
| **Remembered shortlist** | Saves interesting roasters locally without accounts | Small/medium; stable business IDs, removable items, storage-failure behavior |
| **Visible active filters** | Chips for search/state/type/cafe with individual clear actions help users understand empty results | Small; reuse the current URL/filter state |
| **Show these results on the map** | Connects the useful directory search to the map instead of starting again | Medium; shared business/place identities and missing-location handling first |
| **Search this map area / nearest cafes list** | Makes the non-map view useful for location discovery and exposes distances | Medium; use verified coordinates with an allowed storage model; no extra routing API is needed for straight-line distance |
| **Data last checked / location not yet verified** | Sets expectations about closures, missing markers, and manual review | Small once refresh timestamps/provenance exist; do not label unreviewed Google candidates as manually verified |
| **A–Z / Z–A choice** and correct singular counts | Adds a simple browsing option and fixes text such as “1 listings” on the NT homepage entry | Small; existing A–Z remains the default |

For the initial v2, choose row-level corrections, copy-search-link, and explicit location use. Defer accounts, elaborate favorites synchronization, ratings rankings, a new backend, and a PWA unless real use shows a need.

## Portfolio presentation and release order

1. Resolve data integrity and the protected-branch updater, then verify a reviewed enrichment run. Add automatic validation so these stay fixed.
2. Migrate the Places services and production channel; resolve provider storage/attribution and publish the policy pages.
3. Fix map layout/permission behavior, accessible names, and preview pagination. Repeat meaningful manual Maps/Safari checks and fresh Lighthouse measurements.
4. Reconcile #10 into a concise practical README plus an approved case study. Include current architecture, deployment/form workflow, setup/environment variable names, test commands, screenshots, and known limitations. Update public social imagery and project links. Describe lessons from race conditions, data matching, accessibility, and reviewed automation using the final implementation.
5. Set `2.0.0`, publish the tested tag/release, and update the portfolio/resume with measured outcomes. A defensible case-study statement is: **“Built and maintain an Australian coffee discovery site using Astro, React, and Google Maps; added shareable directory search and reviewed form-to-GitHub automation, with 87 unit tests and 60 browser checks.”** Use a cleaned unique-business count and the post-fix performance baseline before adding those metrics to the statement.

## Review scope and limits

Reviewed application routes/components/hooks/styles, all data collections, enrichment and form/recovery code, release helpers and regression coverage, package/lock configuration, GitHub workflows/rules/issues/PRs/releases, Netlify configuration, production routes/metadata/headers, Maps runtime behavior, current npm metadata/advisories, and official Google/Netlify/GitHub documentation. Used completed green runner/main checks rather than rerunning unchanged suites.

This review did not send a new form submission, run paid bulk enrichment, change Google Cloud/Netlify account settings, merge draft #10, or publish a v2 release. Account key restrictions, token expiry, applicable provider agreement, actual cafe access/closures, Safari/assistive technology behavior, and field performance remain explicit verification tasks. Initial browser metadata checks blocked analytics; Lighthouse used its standard navigation configuration. No credentials or raw form exports are included in this report.
