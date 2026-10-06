# Maintainer operations

Production configuration, reviewed form ingestion, temporary map coordinates and recovery. For local setup and contributions, see [CONTRIBUTING](../CONTRIBUTING.md).

## Form submission pull requests

After a production form submission is verified, Netlify invokes `app/netlify/functions/submission-created.mts`. The function validates the directory fields, reads the latest `main` data through GitHub's API, and creates a `forms/<submission-id>` branch and review PR. It never writes to `main` or merges PRs. The Netlify platform [verifies event signatures](https://docs.netlify.com/build/functions/trigger-on-events/#signature) before invocation; no webhook notification needs to be configured.

Recommendations require a name, HTTP(S) website, state, cafe status, and multi-roaster status. Corrections identify the existing listing by website/name; the optional original website supports renamed listings and changed URLs. Blank state/status fields preserve existing values. Corrections with only explanatory notes open a PR containing a review receipt, so a maintainer can make the corresponding edit. Unmatched or ambiguous corrections are rejected and logged for manual follow-up. Recommendations already in the directory are skipped. Corrections retain the immutable business ID and keep prior website identities as aliases; recommendations receive an ID derived from their submission. A different brand on an existing domain is rejected for manual review.

Each PR commits directory changes, the release version files when data changes, and a whitelisted receipt under `.github/form-submissions/`. Names, websites, and notes become public, as explained on the form; contact details, IP addresses, and other raw submission metadata are excluded. Duplicate deliveries reuse an existing open or closed PR. A retry after a branch was created resumes PR creation without overwriting the branch. Distinct submissions can propose overlapping edits; review conflicts and duplicate proposals before merging. Future changed records include `provenance` with a community-submission receipt, proposal time, and an explicit unknown verification time (`verifiedAt: null`). Proposal time is not a claim of independent fact checking. Explanation-only and duplicate submissions do not refresh this metadata. A new map location requires separate place-ID/source review; form PRs never discover or retrieve Google locations.

### Future map locations and temporary coordinates

Keep durable business facts in the reviewed directory, sourced from operators, their websites or independent community submissions. Add a reviewed Australian branch to `app/src/data/reviewed-places.json` in a review PR, for example:

```json
{
  "businessId": "biz-example-coffee",
  "locationId": "loc-example-branch",
  "placeId": "confirmed-google-place-id",
  "Name": "Example Coffee — Melbourne branch",
  "state": "VIC",
  "hasCafe": true,
  "countryCode": "AU",
  "source": {
    "url": "https://example.coffee/locations",
    "reviewedAt": "2026-10-06T00:00:00Z"
  }
}
```

The business ID must reference a current directory record. Review business/branch identity and cafe access before adding an ID; an Australian Google response alone does not prove the match. Preserve business, location and place IDs through corrections. The registry rejects duplicates, invalid references, missing sources, and provider coordinate/rating fields. A separate legacy identity manifest preserves all 218 accepted map places without rewriting their snapshot or timestamps. See the [data review guide](directory-data.md) for the shared schema, source scopes and website aliases.

The map automatically displays all valid cached locations. Its production-only `place-coordinates` endpoint reads the cache and never calls Google. Cached responses use `no-store` headers, remain only in the mounted map's memory, and are removed from that map at expiry. Fresh coordinates replace the matching legacy marker without duplication; accepted legacy markers remain the fallback. A reviewed branch with a confirmed place ID has a Google Maps link until its first successful coordinate retrieval. Independently sourced address-only branches are also supported by the registry and directory, but cannot enter the coordinate worker or produce a marker until a place ID is reviewed.

The hourly `refresh-place-coordinates` function uses the **218 unique Australian IDs** already represented by the accepted legacy markers, plus new reviewed IDs. It extracts only IDs and labels into its allowlist; it does not migrate historical Google fields or invent historical review dates. It processes up to four due locations per run, with at most two concurrent requests, using Place Details (New) with `id,location,addressComponents`. It validates response ID, Australian country and coordinates. Only coordinates, country/provider identity and actual retrieval/expiry times survive in the site-wide Netlify Blobs store `place-coordinates-v1`. Addresses, ratings, counts and raw responses are discarded. Existing selected-place details remain transient active displays.

Coordinates renew from **day 27** and expire after **29 days**. Valid cached coordinates remain available if a renewal fails. Failed renewals retry after a day while the coordinates are still valid; missing or invalid IDs retry after ten days to protect the allowance. Retry timing survives a calendar-month change. The hourly worker also purges expired immutable retrieval keys; the daily `purge-place-coordinates` function independently deletes expired copies without making Google calls. Cache reads exclude expired entries immediately. Deleting an older key cannot remove a newer concurrent retrieval. Monitor scheduled function failures and restore cleanup within the one-day margin before 30 days; a prolonged hosting outage cannot guarantee physical deletion. No runtime refresh writes Git, changes the legacy snapshot, increments a package version, or creates a data PR.

The worker allowance bounds coordinate lookup attempts only. Map loads, autocomplete, selected-place details and Netlify hosting/storage have separate usage. Check [Google Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing), billing-account usage and provider quotas when configuring production; the worker limit does not guarantee a $0 account bill.

Production setup:

1. Enable Places API (New) and configure a separate server/API-restricted `GOOGLE_PLACES_SERVER_API_KEY` in the production Functions environment. Keep the existing browser key/referrer restrictions for Maps. Deploy previews cannot read, refresh or delete production runtime coordinates.
2. Set `PLACE_COORDINATES_MONTHLY_LIMIT=1000` in the production Functions environment. Missing/invalid/zero values disable new Google requests; valid cached coordinates can still be served. Values are capped at `1000` attempts per UTC calendar month for this site. Check billing-account usage and provider quotas before activation; this bounds the worker's requests, rather than all Google or Netlify charges.
3. Deploy and verify the scheduled badges/logs for hourly refresh and daily purge, plus one location's retrieval/expiry timestamps on the map. Netlify supplies Blobs credentials to Functions; no personal token is required. The Netlify Functions UI's **Run now** action can start the first batch. Scheduled functions cannot be invoked through a public URL. Until configured, the map remains usable with its retained markers.

Strong reads and conditional writes reserve the shared monthly budget before each provider attempt. Concurrent duplicate retrievals are suppressed; leases bound active requests to two across instances and are released on completion, with a 60-second cooldown per ID. Failed attempts count toward the budget. Storage/credential/API failures, exhausted limits and unmatched IDs leave ordinary browsing available. Only known map IDs can spend the budget, and visitor traffic cannot trigger lookups. Netlify hosting/storage quotas still need account monitoring. No new ratings cache or rating endpoint is introduced here.

The retired `update-roasters` command, bulk discovery/enrichment scripts and unused intermediate datasets have been removed. The weekly GitHub update workflow is also removed; curated changes continue through reviewed PRs, and runtime coordinates use the bounded worker above.

References: [Netlify Blobs consistency and conditional writes](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [Place Details fields and billing tiers](https://developers.google.com/maps/documentation/places/web-service/place-details), and [Google Maps service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms), [place ID retention](https://developers.google.com/maps/documentation/places/web-service/place-id), and [Netlify scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/).

### Release versioning

App releases choose the major/minor numbers manually; form data updates increment only the final patch number. For example, after a manual app release sets `2.0.0`, subsequent data PRs propose `2.0.1`, `2.0.2`, and so on. A patch increment from `2.0.9` produces `2.0.10`, without changing the app's major/minor numbers. GitHub tags use the canonical `v2.0.0`/`v2.0.1` form.

A data-changing PR reads `app/package.json` and `app/package-lock.json` from the same latest-main commit as the directory data, then updates the package version, lockfile version, and lockfile root package version atomically with its data changes. The PR description and receipt record the proposed version. Retries reuse that version rather than incrementing again. Duplicate recommendations and explanation-only corrections do not bump the version. If a maintainer adds a directory edit to an explanation-only correction, include the appropriate patch bump before merging.

If main's version advances while a PR is open, update that PR's package and lockfile versions to the next patch after main before merging. Two pending PRs can initially propose the same patch; the automation leaves reviewed branches untouched. Release publication remains manual: the function never creates tags or publishes GitHub releases, and merging a version bump follows the existing Netlify main-branch deployment behavior.

CI validates stable, matching package/lockfile root versions on every run. For `forms/` PRs it also compares the tested merge commit with current main: directory changes require exactly the next patch; explanation-only proposals keep main's version. If main advances, update the proposal branch from main, resolve the data conflicts, and set all three versions before rerunning verification. This applies whenever an application release changes the major/minor version.

For a larger app release, select the stable version explicitly, for example `npm version 2.0.0 --no-git-tag-version --ignore-scripts` from `app/`, commit both version files, and publish the matching GitHub release after review. Keep package and lockfile root versions aligned; mismatched files and prerelease versions stop automated data PR creation instead of guessing the next version.

### Activation

1. Create a GitHub fine-grained personal access token restricted to `xdaybreakerx/beanfinder.coffee`, with **Contents: read/write** and **Pull requests: read/write** permissions. Metadata read access is automatic. Set an appropriate expiry and rotate the token before it expires.
2. In the Netlify project's environment variables, add `FORM_PR_GITHUB_TOKEN` for the **production** deploy context, including the **Functions** scope (or all scopes on plans without scope selection). Keep the token out of Git and local payload files. The repository name and target branch are fixed in the implementation.
3. Merge and deploy the reviewed configuration change, or trigger a new production deploy after changing the variable. Netlify snapshots function environment variables at deployment time; [`netlify.toml` variables are not available at function runtime](https://docs.netlify.com/build/functions/environment-variables/).
4. Submit a real recommendation and confirm its PR and CI/Netlify checks. Preview events are ignored. PRs created with this token trigger normal review checks rather than using the Actions `GITHUB_TOKEN`.

The legacy event filename intentionally retains the submission ID, which the newer typed form event omits, so the automation can deduplicate deliveries. The static form in `app/public/__forms.html` must mirror the visible field names; browser tests check this.

### Recovery and local testing

GitHub/network failures fail the function visibly in Netlify logs; malformed submissions log a rejection without their raw data. Netlify retains the submission independently of PR creation. Do not assume failed events are automatically retried. A maintainer can retry using a local JSON file containing the event's `payload` object (or `{ "payload": ... }`). Only retry submissions confirmed as verified in Netlify. For example:

```json
{
  "id": "netlify-submission-id",
  "form_name": "roaster-form",
  "data": {
    "submission-type": "recommendation",
    "roaster-name": "Example Coffee",
    "roaster-website": "https://example.coffee/",
    "state": "VIC",
    "has-cafe": "true",
    "multi-roaster": "false",
    "details": "Suggested directory addition"
  }
}
```

From `app/`, run `node src/scripts/replay-form-submission.mjs /path/to/payload.json --dry-run` to validate against local directory data without API calls. To create or resume the real PR, securely set `FORM_PR_GITHUB_TOKEN` in your shell and run the same command without `--dry-run`. Do not paste tokens into command history. This event function handles new events; installing it does not replay the existing backlog.

Production failures emit a fixed `Form ingestion failed` summary with a reason and recovery action, without raw payloads, credentials or provider response bodies. `missing-token` requires setting the production Functions variable. `github-401` generally requires renewing the token; `github-403` requires checking repository/permission access and rate limits; `github-429` or `github-5xx` requires waiting for recovery before replay. Other request/proposal failures require checking availability, version consistency and the existing branch before retrying. Rejected submissions return 422 for manual review; operational failures remain failed invocations.

For token renewal, create a replacement fine-grained token with access to this repository and **Contents** and **Pull requests** read/write permissions. Replace `FORM_PR_GITHUB_TOKEN` in Netlify's production Functions environment, redeploy so Functions receives it, and securely use the replacement for the maintainer replay command. Replay the same verified submission ID: an existing PR is reused, and an interrupted proposal resumes without overwriting reviewer changes. After verifying recovery, revoke the old token and record the replacement's expiry in your private account reminders. Local fixture tests exercise authentication errors, duplicate/concurrent events, partial failure, replay and redaction without submitting a real form.

### Repository protection and CI

The default branch requires a PR and the GitHub Actions **`verify`** check, with the branch tested against current main and no bypass actors. The repository's default Actions token permissions are read; the verification workflow explicitly needs only `contents: read`. Netlify's form function uses the separately scoped production token so its PRs trigger ordinary checks. Default-token PR creation/approval stays disabled. See [GitHub's ruleset API](https://docs.github.com/en/rest/repos/rules) and [workflow permissions/concurrency](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

The workflow cancels superseded runs for the same PR, keeps distinct PRs isolated, and allows main verification to finish. A bounded timeout and failed-run summary make failures visible. Form ingestion uses immutable Git trees/commits and atomic branch creation to publish directory, release files and receipt together; duplicate delivery races reuse the winning branch/PR. Distinct submissions remain independent proposals for manual conflict review. Local backfills prepare files on a clean review branch; commit the complete batch together and open a PR. Runtime coordinate workers never write Git or create release PRs.

For older verified submissions, use the maintainer batch command from a clean branch based on current main:

```sh
node src/scripts/backfill-form-submissions.mjs /private/path/verified-submissions.json src/data/form-backfill-reviews-2026-10-05.json
node src/scripts/backfill-form-submissions.mjs /private/path/verified-submissions.json src/data/form-backfill-reviews-2026-10-05.json --write
```

The input is an array of verified payloads exported from Netlify's form submissions API, ordered oldest first. Keep the export outside the repository. The review file maps submission IDs to `fields` overrides, optional official website `sources`, or `{ "action": "skip", "reason": "..." }`. Fields use the form's names and string values, including `"true"`/`"false"` for cafe and multi-roaster status. Legacy checkbox selections are converted into the new submission type; ambiguous selections and missing classifications remain `needs-review`. Supply reviewed `details` for corrections; historical free text and private metadata are excluded automatically.

The command defaults to a dry run. `--write` prepares only local directory, receipt, and version files; review the diff and open a PR before merging. All data changes share one patch bump. Recommendations already listed and repeated backlog recommendations are skipped; existing receipts make subsequent runs idempotent. Review conflicts with other pending data PRs before merging.
