# Maps modernization and release polish

Implemented and deployed on 6 October 2026, combining v2 plan steps 4 and 7. Hosted/production Maps, actual desktop Safari, maintainer iOS/VoiceOver review and the fresh Lighthouse baseline are complete; see [release verification](release-verification.md).

## Map behavior

The browser loader and React API provider both use the weekly Maps channel. Startup loads only maps and markers; Places loads when the map's location search needs it. The selected-location panel is a separate lazy chunk. The retired Extended Component Library dependency and its unused resize logic have been removed.

The new PlaceAutocompleteElement searches Australian suburbs and towns, using includedRegionCodes: ["au"] and the "(regions)" primary-type collection. A selected prediction requests only location, viewport and addressComponents. Its country must be AU and its coordinates valid before the map moves. An unfinished lookup cannot override a newer search or explicit location action. Denied searches and unavailable geometry leave map browsing available.

"Use my location" requests permission only on activation, with a ten-second browser timeout and a twelve-second overall deadline. A denied, unsupported, unavailable or timed-out request offers manual search. The position remains in the mounted map's memory and is not written to storage, forms or curated data. An unmounted or timed-out request cannot later move the map.

Cafe-only discovery is on by default. It joins provider place IDs to stable directory identities, using explicitly reviewed branch access before the inherited business-wide cafe flag. Ambiguous identities are excluded from cafe-only browsing, while all-location browsing preserves every accepted legacy marker. Cafe flags are directory information, not a new independent verification of public access or opening hours. The UI explains this limit.

Selected markers show the curated business name, cafe classification and operator website. Current addresses request only formattedAddress and addressComponents through Place Details (New), require an AU country component and remain only in the open panel. The panel has Google Maps attribution, precise place-ID links and directions even when retrieval fails. No live ratings, review counts, photos or hours are fetched. Weekly gmp-click events handle pointer activation. An explicit keyboard path covers clustered markers across engines, with a short deduplication window to prevent a matching native event from opening details twice. Cluster cleanup clears markers and detaches its map/listener.

The server-rendered fallback and React loading/error state render the same disabled controls and reserve the map canvas height. Without JavaScript the directory link and explanatory message are still available. Loader/network failures and late Google authentication failures use the same directory fallback. Existing historical markers, the 29-day coordinate cache and production-only refresh/purge functions retain their separate data lifecycles.

## Requests and account configuration

Browser selections and marker details share a maximum of 20 explicit Place Details attempts per mounted map, including failed attempts. On exhaustion, manual map browsing and Google Maps links remain available. Reloading starts another visit: this is a UX guard, not a billing-account-wide quota or protection against automated traffic. Autocomplete prediction requests are managed by the widget and its session tokens.

The server coordinate worker already uses Place Details (New), explicit minimal fields and the existing 1000-attempt monthly allowance. No legacy server search/enrichment entry points remain. New branch IDs continue to require independent identity/source review; this change introduces no automated rediscovery or permanent provider-field writes.

Keep the browser/referrer-restricted GOOGLE_MAPS_API_KEY separate from GOOGLE_PLACES_SERVER_API_KEY in production Functions. Enable Places API (New) for autocomplete and selected-place retrieval. Verify Maps, Autocomplete and Details quotas, billing-account free usage, budget alerts, production/preview referrers and server API restrictions in Google Cloud. These are account controls; a browser visit limit and budget alerts do not guarantee a $0 account bill. Local localhost access may be disallowed by the configured browser key. Local live verification can route an isolated browser's BeanFinder-origin pages to the local build without changing the public site or key restrictions.

References: [new autocomplete](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new), [widget API and session tokens](https://developers.google.com/maps/documentation/javascript/reference/places-widget), [Google Maps versioning](https://developers.google.com/maps/documentation/javascript/versions), [Places policies and attribution](https://developers.google.com/maps/documentation/places/web-service/policies).

## Public pages and metadata

Privacy and terms pages cover hosting/forms, community publication, Google Maps/location, theme storage, operator checks and external websites. They link Google's privacy policy and terms, and the footer and map link both pages. Google Analytics has been removed at the maintainer's request; there is no tracking script or consent UI.

Each main route has its own title/description, canonical URL and matching Open Graph metadata using https://beanfinder.coffee. Filter query parameters are omitted from canonical URLs. Production sitemap generation includes server-rendered entry routes and public policy pages, and omits utility routes and retired state redirects. robots.txt points at the apex sitemap; submission-success, 404 and form-detection pages carry noindex metadata. A new cream/coffee-brown social image and explicit large-image card metadata are deployed for v2; see [release verification](release-verification.md) for the completed accessibility/performance checks and social-preview deployment status.

## Dependency-advisory decision record

A network-backed npm audit on 6 October 2026 reported 14 high-severity affected dependency nodes, covering six leaf advisories in four packages. The affected chain is the Netlify adapter's local dev stack; this count is not 14 distinct vulnerabilities.

| Package | Installed affected path | Treatment |
| --- | --- | --- |
| braces 3.0.3 | Netlify functions dev → zip-it-and-ship-it → fast-glob → micromatch | Advisory lists no patched release. Avoid exposing local emulation to untrusted glob patterns; track the upstream fix. |
| extract-zip 2.0.1 | Netlify functions dev | Both symlink/archive traversal advisories list no patched release. Do not introduce untrusted archive extraction into application routes. |
| node-forge 1.4.0 | Netlify dev → images → ipx → listhen | Advisory lists no patched release. The application does not implement RSA signature verification using this package. |
| sharp 0.34.5 | Netlify dev → images → ipx | Fixed newer releases exist, but ipx requests the 0.34 family. An override into 0.35 would cross its declared compatibility range; keep this as an upstream/compatibility follow-up. Astro's separate optional sharp is already 0.35.5. |

Do not run npm audit fix --force: npm proposes downgrading @astrojs/netlify to 6.5.13, outside the current Astro 7 adapter pairing. This implementation removes an unrelated obsolete UI dependency and leaves the adapter versions intact. The application has no uploads/image transformation routes and uses local static image assets. Local emulation is bound to loopback. Dependency advisories are still open; this record assesses scope and chooses no unsafe automatic downgrade. A clean browser/build result does not resolve these advisories. On 6 October 2026 the maintainer explicitly accepted proceeding with the existing Netlify dev/build tooling advisories; remediation is deferred and is not a blocker for this release.

References: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [extract-zip symlink traversal](https://github.com/advisories/GHSA-jmr9-qjv8-65gv), [extract-zip archive writes](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3), [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [sharp/libvips](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), [sharp/libheif](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c).

## Verification and remaining release checks

Validation passed: **185 unit tests and 124 desktop/mobile browser checks**, TypeScript, directory/location validation, the production build and diff checks. All four custom Netlify functions bundle for Node 24, and their esbuild input manifests contain none of the four affected leaf packages. At that implementation checkpoint, package/lock roots remained `1.1.0`; curated data, the accepted legacy snapshot and runtime coordinate lifecycle are unchanged.

The compiled Netlify SSR/prerendered output passed live Chromium and installed WebKit checks under an isolated BeanFinder origin routed to localhost. Google loaded `3.66.7` on weekly; permission requests stayed at zero on arrival; the map canvas moved **0 px** between loading and readiness at mobile width. Keyboard Australian autocomplete and individual marker activation worked; a current AU address and place-ID directions loaded; the open panel had no automated WCAG violations. Cafe/all-location switching showed 146/218 locations. Both themes at 320, 375 and 414 CSS px, with normal and 200% text, fit without horizontal overflow. Production screenshots of the mobile map/details panel and desktop view were inspected. WebKit exposes hidden provider marker copies to some automation selectors, so its activation check explicitly selected a marker in the visible provider slot. Both engines passed a focused marker Enter activation and selected-address retrieval. Installed WebKit is not an actual Safari/iOS or assistive-technology sign-off. This exercise changed no hosted site/account setting and made only bounded interactive Maps/Details requests; it did not invoke runtime refresh or bulk discovery.

Automated coverage includes new-widget fields/country checks, stale asynchronous responses, per-visit limits, explicit location permission/timeout/denial/unmount behavior, reviewed branch cafe precedence, fresh-coordinate replacement, authentication failures, selected-address failures and directions fallbacks, matching route metadata, no Analytics requests, stable loading/error geometry, no-JavaScript content, footer targets, policy pages, both themes, 320–414px layouts and enlarged text.

The subsequent hosted and production checks, actual desktop Safari, maintainer iOS/VoiceOver review and fresh Lighthouse baseline completed the accessibility/performance action item. Protected-branch checks and form-automation recovery are also implemented. The final documentation/version candidate sets `2.0.0`; its approved merge/deployment and tag/release publication remain separate release steps.
