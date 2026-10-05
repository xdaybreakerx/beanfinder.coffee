# Historical form backfill — 5 October 2026

The production event function successfully created test PR #13. Older verified submissions predate that function and use checkbox fields without cafe/retailer classifications. This batch accounts for all 28 historical submissions plus the excluded new test. The verified API export stays outside the repository; only public directory fields and reviewed receipts are committed.

## Proposed changes

20 additions (18 individual roasters and 2 multi-roaster listings), one website correction, and one combined patch bump from `1.0.0` to `1.0.1`. Existing location enrichment runs after merge. The original classifications were checked against official websites; the remaining nine additions use the maintainer's manual research recorded below. Linked websites for those entries are references for the maintainer's research. All historical entries are now classified, deduplicated, or explicitly excluded.

Path serves its own coffee and guest roasters, so it is classified as a multi-roaster venue. The Humble Tigers submission is added under its current name and website, Tone Coffee Roasters.

| Listing | State | Cafe | Multi-roaster | Evidence |
| --- | --- | --- | --- | --- |
| Boof-Pa Beans | ACT | no | no | Maintainer manual research; [source 1](https://boofpabeans.com.au/) |
| Klim Coffee Roasting Co | VIC | yes | no | [source 1](https://klimcoffee.com.au/about) |
| Project 281 | VIC | yes | no | [source 1](https://project281.com/about/) |
| First Love Coffee | VIC | yes | no | [source 1](https://firstlovecoffee.com.au/pages/cafe); [source 2](https://firstlovecoffee.com.au/pages/rustica) |
| Good Hustle Coffee Roasters | VIC | no | no | Maintainer manual research; [source 1](https://goodhustlecoffee.com.au/) |
| Four Kilo Fish | VIC | yes | no | [source 1](https://www.fourkilofish.com.au/pages/four-kilo-fish-coffee-and-tea-hawthorn) |
| Tone Coffee Roasters | VIC | yes | no | Maintainer manual research; [source 1](https://www.tonecoffeeroasters.au/) |
| Bench Coffee Co | VIC | yes | no | [source 1](https://benchcoffee.co/); [source 2](https://benchcoffee.co/pages/bench-coffee-co-green-st) |
| DC Coffee | VIC | no | no | Maintainer manual research; [source 1](https://dccoffee.com.au/) |
| Cortado Coffee Roasters | VIC | no | no | Maintainer manual research; [source 1](https://cortadocoffee.com.au/) |
| Red Bean Coffee Roasters | VIC | yes | no | [source 1](https://www.redbeancoffee.com.au/preston-cafe/) |
| Fieldwork Coffee — replace Bay Beans link | VIC | preserved | preserved | [source 1](https://fieldworkcoffee.com.au/) |
| Path Melbourne | VIC | yes | yes | [source 1](https://www.pathmelbourne.com/); [source 2](https://www.pathmelbourne.com/uploads/b/877bdfe0-e45d-11ea-8ba8-d5837b2ee97d/0a31ca10-56b1-11ef-9a47-c9a69f402c37.pdf) |
| The Flour | VIC | yes | no | Maintainer manual research; [source 1](https://www.theflourmelbourne.com/) |
| Core Roasters | VIC | yes | no | [source 1](https://www.coreroasters.cc/roasterycafe) |
| Born And Raised | VIC | no | no | Maintainer manual research; [source 1](https://bornandraised.coffee/) |
| Beat Coffee | VIC | yes | no | [source 1](https://beatcoffee.com.au/pages/link-page) |
| BeanHub | all | no | yes | [source 1](https://beanhub.com.au/); [source 2](https://beanhub.com.au/shipping-policy) |
| Siboni's Coffee | NSW | yes | no | Maintainer manual research; [source 1](https://www.siboniscoffee.com.au/) |
| Brewno Specialty Coffee | QLD | no | no | Maintainer manual research; [source 1](https://www.brewnospecialtycoffee.com.au/) |
| Leaping Goat Coffee | TAS | yes | no | [source 1](https://www.leapinggoatcoffee.com.au/pages/cafe) |

## Maintainer research incorporated

The maintainer supplied these decisions on 5 October 2026. They are reflected in `app/src/data/form-backfill-reviews-2026-10-05.json` and the resulting directory entries:

- Exclude Vittoria Coffee because it is outside the specialty coffee directory scope.
- Boof-Pa Beans is an online micro-roaster based in ACT, with no cafe.
- Good Hustle Coffee Roasters is an online roaster based in VIC, with no cafe.
- Humble Tigers has rebranded to [Tone Coffee Roasters](https://www.tonecoffeeroasters.au/), with its own roasts online and two cafes.
- DC Coffee is an online roaster with no cafe.
- Cortado Coffee Roasters is classified as an online roaster with no cafe.
- The Flour has a cafe and uses its own specialty beans.
- Born And Raised is a roaster with no cafe.
- Siboni's Coffee is a roaster with a cafe. Its previously unselected type is resolved as a recommendation.
- Brewno Specialty Coffee is a roaster with a coffee cart, with no fixed cafe location.

## Skipped entries

Three recommendations already exist on main: Zest (its reviewed canonical homepage matches the existing listing), Coffee Supreme, and Ritual Coffee Roasters.

| Repeated submission | Kept recommendation |
| --- | --- |
| `6886ee27e69a685dc818acfe` | `67998d69bdb79800c37a9da3` |
| `68a02455de76120066e7b54d` | `6755856249114c0bb1d3e7d1` |
| `6ac22b9bbcffd0beca9248d6` | `6ac22b9ad4314ac18e7a05fd` |

Vittoria Coffee (`67049c62cd9390007dae6a6a`) is excluded by maintainer review. The newer `tester` submission (`6ac34a2edd47674b1906198d`) is excluded because its test PR #13 was closed without merging. Netlify submissions are retained; no submission was deleted or changed.

## Re-running the backfill

Use the command documented in the README with an array of verified Netlify payloads and the review file. Existing receipt IDs prevent repeated corrections and another version bump for this completed batch. No entries in this batch remain `needs-review`. Future incomplete submissions still require classification. Review the version against current main before opening another PR.
