# v2 release verification

Checked 6 October 2026 against production at <https://beanfinder.coffee> after [PR #22](https://github.com/xdaybreakerx/beanfinder.coffee/pull/22), merged main `d92d0bc2fa833dffa1318bf93a643792f23b7c76`. Package and lockfile roots remain `1.1.0`. This record does not publish the v2 release.

## CI

[Post-merge main verification](https://github.com/xdaybreakerx/beanfinder.coffee/actions/runs/37428299340) completed successfully. Data validation, release validation, TypeScript, unit tests, build and desktop/mobile browser tests all passed. PR #22's verified tree had 204 unit tests and 126 browser checks. These existing checks were not rerun for this documentation-only record.

## Production Lighthouse baseline

Lighthouse 13.5.0, headless Chrome, default simulated mobile throttling; desktop uses the desktop preset. Each row is one fresh navigation measurement on the deployed site, collected between 07:20 and 07:26 UTC. These are lab results, not field Core Web Vitals or guaranteed scores.

| Route / profile | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Homepage / mobile | 100 | 100 | 100 | 100 | 1.1 s | 0 ms | 0 |
| Homepage / desktop | 100 | 100 | 100 | 100 | 0.3 s | 0 ms | 0 |
| Directory / mobile | 100 | 100 | 100 | 100 | 1.3 s | 0 ms | 0 |
| Map / mobile | 91 | 100 | 100 | 100 | 1.3 s | 380 ms | 0 |

No run warnings were reported. The visible-label/accessibility-name audit passed on the map and was marked not applicable on the other three runs; it reported no failing elements. The immediate-geolocation audit passed on all four. Compared with the 5 October mobile map baseline, measured CLS decreased from 0.194 to 0 and performance increased from 61 to 91. Third-party Maps execution still contributes blocking time. All four pages were measured with the same Lighthouse version as the earlier baseline.

## Native Safari checks

Actual macOS Safari 26.6.2 (build 21624.5.1.11.3), using a dedicated production tab:

- The live Google map loaded without a location permission prompt on arrival. Melbourne autocomplete exposed its prediction in the accessibility tree; Down/Return selected it and moved the map.
- A visible Common Folk Coffee marker opened details, moved focus to the details heading and retrieved `43 Playne St, Frankston VIC 3199, Australia`. Google Maps attribution and operator links were present. The Maps and directions links included the selected place ID. Closing details returned focus to autocomplete, as implemented.
- Option-Tab reached the map and the Dtown Coffee Roasters marker; Enter opened details and retrieved `U2/9 Travers St, Coconut Grove NT 0810, Australia` with place-ID directions. Arrow-key navigation reached a cluster of 29 markers; Enter zoomed into that cluster and exposed individual markers. Fullscreen entry, Zoom in and Escape exit worked; the map link confirmed zoom increased from 3 to 4.
- Explicit location activation produced Safari's permission prompt. It was rejected without transmitting the user's location. The application's deadline elapsed while the prompt was being inspected, so the observed message was the timeout fallback, not a separately verified immediate-denial message. Map browsing and cafe/all-location switching remained usable, showing 146/218 locations. Immediate denial is covered by the existing automated tests; actual iOS denial review remains pending.
- Both light and dark themes were used during navigation. Directory search retained `?q=BENCH`, returned one business and exposed all five sourced branch links. Space closed the focused native branch disclosure. Clearing filters reset the URL; Next advanced to `?page=2`, showed page 2 of 20 and moved focus to the results.
- Safari's page menu confirmed 200% and 300% zoom. Directory controls and content reflowed without visible horizontal clipping in the inspected light-theme views. Safari's available zoom menu tops out at 300%; this is not a 400% verification result. The tab is restored to 100% after testing.

These focused native checks supplement the earlier automated Chromium/installed WebKit and 320–414 px / 200% text coverage. They do not constitute a complete assistive-technology or iOS sign-off.

The production submission form's controls and accessible labels were inspected. Automatic approval review rejected an attempted blank Submit activation because it could create a production submission; the action was not retried. Existing passing browser tests use intercepted local requests to verify recommendation/correction requirements, submission failure messages and retry behavior. Native Safari form-error UI was not verified.

## iOS and VoiceOver review

The maintainer reported an iPhone 17 Pro Max on iOS 27.0.1 and confirmed: “at Highest zoom levels, and voice over both find no faults”. This was the response to the requested production review covering both themes, enlarged text, control names, directory filters/pagination, autocomplete, marker details/directions and location denial. This is maintainer-supplied device verification, not an independently observed automated result.

**Accessibility and performance action item: CLOSED — 6 October 2026. Release verification: SIGNED OFF.** Merged-main CI, deployed live Maps, native desktop Safari, the maintainer's actual iOS/VoiceOver review and fresh Lighthouse baseline are complete. No material regression was reported in this verification. Production form-error activation was omitted following automatic approval review; existing passing intercepted-request tests cover the form requirements/error/retry behavior. Previously accepted Netlify development/build dependency advisories remain deferred. This completes release verification; documentation/version/tag/release work follows separately.

## Social preview refresh

Created a new social-sharing image with the built-in imagegen tool on 6 October 2026: `app/public/beanfinder-og-v2.jpg`, 1730 × 909 pixels. The cream/coffee-brown design uses a large serif BeanFinder title, the subtitle “Australian coffee directory”, and roasted coffee beans in a ceramic bowl. The generated PNG was encoded as a smaller JPEG without changing its composition. The original public image remains available for older cached links.

The shared HTML layout now uses the new image URL, declares its actual dimensions/type, supplies descriptive image alternative text and adds explicit large-image X/Twitter card tags. Titles/descriptions retain each route's metadata; filtered directory links retain the general directory preview. Image metadata follows the [Open Graph structured-image properties](https://ogp.me/#structured). Source artwork and exact generation prompt remain local; this section records the project asset and tool.

This refresh is prepared on the feature branch; production still serves the previous image until the change is merged/deployed. A final deployed HTML/image check is part of release completion. Individual social-app preview caching has not been tested.

Local refresh validation passed: TypeScript, curated-data/release-version validation, production build, and the existing desktop/mobile route-metadata checks (2 tests). The final built Netlify SSR handler served matching Open Graph/card titles, descriptions, image URLs and alternative text for the homepage, filtered directory and map without executing client JavaScript. The four prerendered pages also carried the new metadata. The emitted JPEG matches the source asset, has the declared 1730 × 909 dimensions and is 370,183 bytes.

## Release follow-up

Keep [draft PR #10](https://github.com/xdaybreakerx/beanfinder.coffee/pull/10) open as a reference for the other repo/project, as instructed by the maintainer on 6 October. Its reconciliation is not a v2 release prerequisite. Refresh current README/screenshots/release notes independently, then set package and lockfile roots to `2.0.0`, verify the final commit/deployment, review any pending form-PR versions and publish the tested tag/release when authorized.

Local measurement evidence: `/private/tmp/beanfinder-release-lighthouse-summary.json` and `/private/tmp/beanfinder-release-{home-mobile,home-desktop,directory-mobile,map-mobile}.report.{json,html}`. Raw browser reports remain local; do not commit reports containing provider request URLs or browser metadata.
