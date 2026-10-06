# Curated directory identities and review

The curated directory contains 239 business records: 231 roasters and eight multi-roaster sellers. `app/src/utils/directorySchema.ts` is shared by rendering, form proposals, recovery tooling and the data validation command. Business records retain their existing display fields and have an immutable `businessId`; names, URLs, state sets and classification can change without changing that ID.

`legacy-place-identities.json` assigns immutable `locationId` values to all 218 accepted legacy place IDs. It stores associations only, with unknown historical verification recorded as null. Coordinates, addresses and scores remain in the unchanged legacy snapshot. Duplicate snapshot branches share one location identity. Ambiguous historical associations retain their candidates until an independently sourced reviewed location resolves them.

`reviewed-places.json` references a business by `businessId`, rather than its mutable website. Each reviewed branch has its own `locationId`, name, AU state/country, explicit `hasCafe`, source URL and actual review date. It requires a confirmed Google `placeId`, an independently sourced street `address`, or both. Addresses use `street, locality STATE [postcode], Australia`; do not invent a postcode when the source omits it. Its website is derived from the current business record at runtime. Reviewed locations override historical association/state labels and addresses. Address-only branches appear in directory searches and link to Google Maps searches, with no invented score or marker. Only confirmed place IDs enter the provider coordinate refresh allowlist. New provider coordinates and ratings cannot be written into this registry.

## Review procedure

1. Search both collections by normalized website and name before adding a business. HTTP/HTTPS, leading `www`, fragments and trailing slashes share an identity; distinct paths, queries and ports remain distinct. A possible same-domain business needs manual review, rather than automatic merging. Separate brands on a shared platform can remain separate records.
2. Assign an unused `biz-…` ID once for a new business and retain it through all corrections/reclassifications. Form recommendations use `biz-form-<submission-id>`. Keep known previous websites in `websiteAliases`; aliases remain reserved to that business and help identify later corrections. Aliases must have distinct normalized identities.
3. Keep roasters in `coffee-roasters.json` and sellers in `coffee-roasters-multi.json`. Use valid, nonrepeated AU states; `all` is available only to sellers. Subscription/selection/brew metadata belongs only to sellers and may remain absent when unverified.
4. Record the source of changed facts. Legacy records use `source: "legacy-directory", verifiedAt: null`. Community proposals record their public receipt and proposal time, with verification explicitly unknown. Operator reviews record a URL, actual `reviewedAt` and the `fields` independently checked; a state review does not verify every other field.
5. Review a branch's identity, state and public cafe access against operator information or independent submissions. Reuse an existing location/place identity when available; assign an unused `loc-…` ID only for a new branch. Existing accepted IDs live in the association manifest; reviewed overrides must reuse their location ID. Preserve existing place IDs through business corrections. Do not treat an Australian Google response as proof of business identity.
6. From `app/`, run `npm run validate:data`, `npm run check`, `npm test` and `npm run build`; run browser checks for changes affecting browsing. Review all related files together in one PR. GitHub rejects invalid identities, references, source metadata, website duplicates and collection classification. The same data validation also runs before every production build.

Deletion needs an explicit review of location references and website aliases; removing a referenced business causes validation to fail. The validator checks that every accepted legacy marker still has a location identity. Runtime refreshes continue to reuse provider place IDs and do not change curated records or package versions.

Rebase data PRs opened before this schema migration onto current main and retain the new IDs/provenance when resolving conflicts. An older new-listing proposal needs a business ID and valid provenance before its checks can pass; replay against current data to regenerate it if needed. Do not overwrite reviewed branch edits during recovery.

## Consolidation audit — 6 October 2026

| Finding | Resolution and evidence |
| --- | --- |
| Exact duplicate Bear Bones records | Kept one record and assigned one business ID; existing QLD facts and locations retained. No new verification claimed. |
| Exact duplicate Cherry Pickers Coffee records | Kept one record and assigned one business ID; existing SA facts retained. No new verification claimed. |
| Coffee in Common listed as VIC and SA under the same normalized website | Consolidated as one SA business. Its [operator contact page](https://www.coffeeincommon.com.au/pages/contact-us) identifies the public cafe at 7 Bacon Street, Hindmarsh SA. Both historical entries use the same place ID and that same SA address. The reviewed branch corrects the state association without editing the snapshot. |
| ACoffee and a.k.a. Coffee shared one Melbourne place ID | [ACOFFEE's operator site](https://acoffee.com.au/) lists its CBD showroom at 2/130 Russell Street, matching the saved address. The reviewed location assigns that existing ID to ACoffee. [a.k.a.'s operator site](https://akacoffee.com.au/) identifies Merrylands NSW; its directory state is corrected, and the unrelated Melbourne link/score is withheld. Its inherited cafe flag was subsequently removed in the [cafe/address audit](cafe-address-audit.md), based on the operator account of selling the earlier cafe. |
| Five listing names had trailing whitespace | Trimmed display names; stable identities and website facts retained. |

There were 242 records before consolidation and 239 afterward. All 218 accepted map markers remain available. This audit does not claim that every inherited business or branch has been independently verified; missing cafe/location evidence remains ordinary review work.

The subsequent [cafe/address audit](cafe-address-audit.md) records missing-location reviews, source links and the maintainer's Siboni's cafe confirmation.

## Repository cleanup — 6 October 2026

An import/reference audit covered application modules, Astro routes, test discovery, package scripts, Netlify functions, CI, recovery commands, documentation and public assets. Removed the unused directory helper `src/utils/utils.js`, intermediate datasets `coffee-roasters-updated.json` and `coffee-roasters-api-testing.json`, retired `google-places.mjs`, and disabled `fetch-roaster-place_id.js` / `fetch-roaster-place_details.js`. Removed the retired `update-roasters` command, four tests specific to legacy enrichment, and the unused `sameWebsite` wrapper introduced during the schema work. Active Australian-location guard/marker tests remain.

Retained the live legacy map snapshot and its identity/freshness manifests, all page routes (including bookmark redirects), public form-detection file, submission receipts, historical review file and recovery scripts. These have runtime, build, audit or recovery uses despite some lacking module importers. The old Lighthouse image remains a historical asset; current README screenshots and measurements are documented separately. The social image/favicon are referenced by the layout.

Cleanup verification passed: 143 relative module references resolved, 172 unit tests passed (four retired-helper tests removed), TypeScript/data validation passed, the production build succeeded, and all four Netlify functions bundled for Node 24. The earlier 102 browser checks cover the unchanged active browsing code.
