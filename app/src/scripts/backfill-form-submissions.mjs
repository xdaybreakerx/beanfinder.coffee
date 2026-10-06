import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { planBackfill, PROCESSED_SUBMISSIONS_PATH } from "../server/form-submission-backfill.ts";

const args = process.argv.slice(2);
const write = args.includes("--write");
const paths = args.filter(arg => arg !== "--write");
if (paths.length !== 2) throw new Error("Usage: node src/scripts/backfill-form-submissions.mjs <verified-submissions.json> <reviews.json> [--write]");
const payloads = JSON.parse(await readFile(paths[0], "utf8"));
if (!Array.isArray(payloads)) throw new Error("Expected an array of verified Netlify submission payloads");
const reviews = JSON.parse(await readFile(paths[1], "utf8"));
const root = fileURLToPath(new URL("../../../", import.meta.url));
const files = {};
try { files[PROCESSED_SUBMISSIONS_PATH] = await readFile(resolve(root, PROCESSED_SUBMISSIONS_PATH), "utf8"); }
catch (error) { if (error.code !== "ENOENT") throw error; }
for (const path of ["app/src/data/coffee-roasters.json", "app/src/data/coffee-roasters-multi.json", "app/package.json", "app/package-lock.json"]) files[path] = await readFile(resolve(root, path), "utf8");
const receipts = resolve(root, ".github/form-submissions");
try {
  for (const name of await readdir(receipts)) {
    if (/^[a-zA-Z0-9-]+\.json$/.test(name)) files[`.github/form-submissions/${name}`] = await readFile(resolve(receipts, name), "utf8");
  }
} catch (error) { if (error.code !== "ENOENT") throw error; }
const plan = planBackfill(payloads, reviews, files);
console.info(JSON.stringify({ results: plan.results, release: plan.release, files: Object.keys(plan.contents) }, null, 2));
if (write) {
  for (const [path, content] of Object.entries(plan.contents)) {
    const target = resolve(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  console.info("Prepared local branch changes. Review the diff, commit, and open a PR.");
}
