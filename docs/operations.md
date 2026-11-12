# Deployment and submission recovery

For local development and PR checks, see [CONTRIBUTING](../CONTRIBUTING.md). For business and branch edits, see the [data review guide](directory-data.md).

## Production configuration

Netlify builds `app/` using the Node pin in `.nvmrc` and `netlify.toml`. Production Functions require:

| Variable | Configuration |
| --- | --- |
| `GOOGLE_MAPS_API_KEY` | Browser/referrer-restricted Maps key; enable Places API (New) and allow the intended website origins. |
| `GOOGLE_PLACES_SERVER_API_KEY` | Separate API-restricted key for coordinate refresh. Keep it server-only. |
| `PLACE_COORDINATES_MONTHLY_LIMIT` | Coordinate attempt allowance per UTC month, capped at 1000. Missing, invalid or zero disables new retrievals. |
| `FORM_PR_GITHUB_TOKEN` | Fine-grained GitHub token for this repository, with Contents and Pull requests read/write; set an expiry and rotate before expiration. |

Set server variables in the production deploy context with Functions scope, then redeploy. Function environment changes take effect at deployment. Previews cannot read, refresh or purge production coordinates. See [Netlify function environment variables](https://docs.netlify.com/build/functions/environment-variables/).

## Submission PRs

Netlify's verified `submission-created` event validates public form fields and creates a `forms/<submission-id>` branch and PR. It never merges or writes to main. Review identity matches, classifications, sources, duplicates and conflicts before merging. Unmatched/ambiguous corrections are rejected for manual follow-up; explanation-only corrections create a PR without a data/version change.

Current community contributions carry whitelisted source receipts under `.github/form-submissions/`. They support provenance, duplicate-event handling and recovery of interrupted branches. Contact details, IPs and raw payloads are excluded. Completed backfill IDs are kept in `.github/processed-form-submissions.json` so replaying an old batch cannot overwrite later corrections; it contains no review notes or submission details. Keep batch review plans and raw form exports outside Git.

When changing form fields, update both the visible form and `app/public/__forms.html`; browser tests check that their names match.

## Replay and batch recovery

Only replay submissions verified in Netlify. Store their payload files outside the repository. From `app/`:

```sh
node src/scripts/replay-form-submission.mjs /private/path/payload.json --dry-run
node src/scripts/backfill-form-submissions.mjs /private/path/verified-submissions.json /private/path/reviews.json
```

Replay accepts a payload object or `{ "payload": ... }`. Batch input is an array ordered oldest first. Its review JSON maps IDs to `fields` overrides, optional operator `sources`, or `{ "action": "skip", "reason": "..." }`; field names match the public form, with string `"true"`/`"false"` classifications. Incomplete or ambiguous entries require review. Historical private/free-text fields are excluded.

The commands above validate locally without API writes. To resume a real PR, securely set `FORM_PR_GITHUB_TOKEN` and run the replay command without `--dry-run`. To prepare a reviewed batch locally, add `--write` to the batch command on a clean branch based on current main. Review and commit the complete data/receipt/version diff together before opening a PR.

| Failure | Recovery |
| --- | --- |
| `missing-token`, `github-401` | Set/renew the production Functions token and redeploy. |
| `github-403` | Check repository permissions and rate limits. |
| `github-429`, `github-5xx` | Wait for service recovery, then replay the same verified ID. |
| Other proposal/request failures | Check logs, version consistency and the existing branch before retrying. |

An existing PR is reused; interrupted branch recovery preserves reviewer changes. After token replacement is verified, revoke the old token. Netlify retains submissions independently of PR creation; failed invocations do not imply an automatic retry.

## Temporary coordinates

Reviewed place IDs and accepted legacy IDs form the refresh allowlist, excluding branches with manually reviewed static coordinates. Those markers are loaded directly from reviewed-places.json; they do not enter the coordinate cache or scheduled retrieval queue. The production-only `place-coordinates` endpoint reads Netlify Blobs without calling Google; cached responses use `no-store`. The hourly refresh processes at most four due locations, with at most two concurrent requests, reserving the monthly budget before every attempt. Failures count toward that budget. Visitor traffic cannot trigger coordinate retrieval.

Coordinates renew from day 27 and expire after 29 days. Failed renewals retry after a day while valid; missing/invalid places retry after ten days. Cache reads exclude expired entries. Hourly refresh and daily purge delete expired retrieval keys; monitor scheduled failures and restore cleanup before the 30-day limit. Addresses, ratings and raw provider responses are not stored in the new cache. Provider place identity, Australian country, valid coordinates and actual retrieval/expiry timestamps are required.

Verify the schedules and retrieval/expiry timestamps after production configuration changes. Browser map loads, autocomplete, selected-place details and hosting/storage have separate quotas from the coordinate worker. Configure provider quotas and monitor account usage. See [scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/) and [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

## Release versioning

Every ordinary PR includes the next patch, minor or major after main; default to patch, choose minor for features and major for breaking changes. Data changes increment only the patch. Update `app/package.json`, `app/package-lock.json` and its root package version together. Duplicate recommendations and explanation-only form corrections do not bump. Runtime coordinate refreshes never change Git or versions.

Form PRs automatically propose the next patch after current main. If main advances, reconcile data conflicts and all three version roots before rerunning `verify`. Two pending proposals may initially share a patch; review them independently. For an ordinary PR, run `npm version patch --no-git-tag-version --ignore-scripts` (or `minor`/`major`) from `app/` and commit both version files. PR verification checks the merged result against current main, so an unchanged or stale version blocks merging.

Main requires a PR and `verify` against current main. After merge, the verification workflow's `release` job automatically publishes the matching `vX.Y.Z` tag and GitHub release with generated notes. It uses only the built-in `GITHUB_TOKEN`, with Contents write permission limited to that job. It does not commit back to main or bypass branch protection.

Netlify and main CI run independently. The site prerenders `/release.json` during the build using the package version and Netlify's `COMMIT_REF`/`CONTEXT` metadata. After `verify` passes, publication polls the production URL for up to roughly 25 minutes (including request timeouts), requiring the exact commit SHA, version and `production` context. Deploy previews, old builds, failed verification and failed/missing production deployments cannot publish a new release. Keep Netlify's production branch set to `main` and its normal automatic publishing enabled.

If deployment is delayed or fails, fix/retry Netlify, then rerun the failed `release` job in **Actions → Verify application**. Repeating a published release is harmless; existing tags are never moved. An unchanged version already tagged on an ancestor (an explanation-only form merge) is skipped. Rapid merges whose deployments are superseded before they are observed live may time out; their changes are included in the next deployed release's generated notes. Run **Verify application → Run workflow** on `main` to reverify and retry the current main release. The workflow never backfills historical tags automatically.
