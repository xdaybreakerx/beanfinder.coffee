# Historical form backfill — 5 October 2026

The production event function successfully created test PR #13. Older verified submissions predate that function and use checkbox fields without cafe/retailer classifications. This batch reviews 28 historical submissions plus the excluded new test. The verified API export stays outside the repository; only public directory fields and reviewed receipts are committed.

## Proposed changes

11 additions (9 individual roasters and 2 multi-roaster listings), one website correction, and one combined patch bump from `1.0.0` to `1.0.1`. Existing location enrichment runs after merge. Cafe and retailer flags are maintainer classifications based on the linked official sources. Path serves its own coffee and guest roasters, so it is classified as a multi-roaster venue.

| Listing | State | Cafe | Multi-roaster | Evidence |
| --- | --- | --- | --- | --- |
| Klim Coffee Roasting Co | VIC | yes | no | [source 1](https://klimcoffee.com.au/about) |
| Project 281 | VIC | yes | no | [source 1](https://project281.com/about/) |
| First Love Coffee | VIC | yes | no | [source 1](https://firstlovecoffee.com.au/pages/cafe); [source 2](https://firstlovecoffee.com.au/pages/rustica) |
| Four Kilo Fish | VIC | yes | no | [source 1](https://www.fourkilofish.com.au/pages/four-kilo-fish-coffee-and-tea-hawthorn) |
| Bench Coffee Co | VIC | yes | no | [source 1](https://benchcoffee.co/); [source 2](https://benchcoffee.co/pages/bench-coffee-co-green-st) |
| Red Bean Coffee Roasters | VIC | yes | no | [source 1](https://www.redbeancoffee.com.au/preston-cafe/) |
| Fieldwork Coffee — replace Bay Beans link | VIC | preserved | preserved | [source 1](https://fieldworkcoffee.com.au/) |
| Path Melbourne | VIC | yes | yes | [source 1](https://www.pathmelbourne.com/); [source 2](https://www.pathmelbourne.com/uploads/b/877bdfe0-e45d-11ea-8ba8-d5837b2ee97d/0a31ca10-56b1-11ef-9a47-c9a69f402c37.pdf) |
| Core Roasters | VIC | yes | no | [source 1](https://www.coreroasters.cc/roasterycafe) |
| Beat Coffee | VIC | yes | no | [source 1](https://beatcoffee.com.au/pages/link-page) |
| BeanHub | all | no | yes | [source 1](https://beanhub.com.au/); [source 2](https://beanhub.com.au/shipping-policy) |
| Leaping Goat Coffee | TAS | yes | no | [source 1](https://www.leapinggoatcoffee.com.au/pages/cafe) |

## Requires classification before import

10 distinct entries remain pending. The older form did not ask about cafe or retailer status; an online store alone does not establish that there is no cafe. Add reviewed string-valued form fields to `app/src/data/form-backfill-reviews-2026-10-05.json` and rerun the batch after confirming these points. For `All`, identify the actual roaster state(s) unless it is a multi-roaster retailer.

| Submission ID | Proposed listing | Submitted state | Remaining review |
| --- | --- | --- | --- |
| `67049c62cd9390007dae6a6a` | [Vittoria Coffee](https://www.vittoriacoffee.com/) | All | Cafe status and roaster/retailer classification; replace All with the roaster state(s) |
| `67379af3beef7800c9bb6f89` | [Boof-Pa Beans](https://boofpabeans.com.au/) | ACT | Cafe status and roaster/retailer classification |
| `67998d69bdb79800c37a9da3` | [Good Hustle Coffee Roasters](https://goodhustlecoffee.com.au/) | VIC | Cafe status and roaster/retailer classification |
| `67998f7a5b7918009ea20baa` | [Humble Tigers](https://www.humbletigers.com.au/) | VIC | Submitted website inaccessible during review; verify current trading status and classification |
| `67aac73647fcef0076696ba0` | [DC Coffee](https://dccoffee.com.au/) | VIC | Cafe status and roaster/retailer classification |
| `686fa272e96aae009e8d9f93` | [Cortado Coffee Roasters](https://cortadocoffee.com.au/) | VIC | Cafe status and roaster/retailer classification |
| `68a024a5f62f2c0070d79ba8` | [The Flour](https://www.theflourmelbourne.com/) | VIC | Cafe confirmed; verify whether it sells its own roasted beans or other roasters before listing |
| `68a025b5faebf90079e6585d` | [Born And Raised](https://bornandraised.coffee/) | VIC | Cafe status and roaster/retailer classification |
| `6a44ed3d007aa419ab6a2cac` | [Siboni's Coffee](https://www.siboniscoffee.com.au/) | NSW | Cafe status and roaster/retailer classification; neither old type checkbox was selected |
| `6a69c4633fe6be0e4c2aa499` | [Brewno Specialty Coffee](https://www.brewnospecialtycoffee.com.au/) | QLD | Cafe status and roaster/retailer classification |

## Skipped entries

Three recommendations already exist on main: Zest (its reviewed canonical homepage matches the existing listing), Coffee Supreme, and Ritual Coffee Roasters.

| Repeated submission | Kept recommendation |
| --- | --- |
| `6886ee27e69a685dc818acfe` | `67998d69bdb79800c37a9da3` |
| `68a02455de76120066e7b54d` | `6755856249114c0bb1d3e7d1` |
| `6ac22b9bbcffd0beca9248d6` | `6ac22b9ad4314ac18e7a05fd` |

The newer `tester` submission (`6ac34a2edd47674b1906198d`) is excluded because its test PR #13 was closed without merging. Netlify submissions are retained; no submission was deleted or changed.

## Re-running the backfill

Use the command documented in the README with an array of verified Netlify payloads and the review file. Existing receipt IDs prevent repeated corrections and another version bump for this completed batch. Incomplete entries remain visible as `needs-review`; repeated incomplete entries reference the first recommendation. Review the remaining classifications and version against current main before opening the next PR.
