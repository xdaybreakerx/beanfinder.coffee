# BeanFinder.coffee

BeanFinder is a directory of Australian coffee roasters, with browsing by state and cafe filter, paginated lists, online subscription listings and a location map. This is a solo project by Juno.

## Stack

- Astro for routes and page rendering.
- React and Google Maps for the map interface.
- Tailwind CSS and DaisyUI for styling and components.
- Repository-managed JSON for roaster records.
- Netlify adapter and form service for hosting and suggestions.

Dependency versions and available scripts are recorded in [app/package.json](app/package.json).

## Run locally

Commands run from the `app/` directory:

```sh
cd app
npm ci
cp .env.example .env
npm run dev
```

Configure `GOOGLE_MAPS_API_KEY` in the local environment for the map. The development server uses `http://localhost:4321`.

| Command                | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `npm ci`               | Install the locked dependencies                 |
| `npm run dev`          | Start the development server                    |
| `npm test`             | Run map geolocation and search regression tests |
| `npm run build`        | Build into `app/dist/`                          |
| `npm run preview`      | Preview the build locally                       |
| `npm run astro --help` | Show Astro CLI commands                         |

The Netlify adapter handles the production build. Hosted form delivery and Google Maps access depend on the corresponding service configuration; a local build does not verify either service.

## Structure and current behavior

```text
app/
  public/__forms.html       Static form declaration for Netlify detection
  src/components/           Cards, controls and React map
  src/hooks/                Map and geolocation helpers
  src/data/                 Roaster JSON records
  src/pages/roasters/        State/cafe/page routes
  src/pages/online-subscriptions/
  src/scripts/              Form and data helpers
  src/utils/                Shared helpers
  astro.config.mjs          Site URL, integrations and Netlify adapter
```

Roaster pages combine state and cafe filtering with pagination. The current cafe-filter `false` branch includes all roasters in a state; its toggle wording needs review so labels and behavior agree. The map uses a client-rendered React component and supporting hooks. Recent regression coverage exercises geolocation arriving before and after map initialization and search behavior.

The directory’s data and third-party links need periodic review. Map availability depends on JavaScript and Google Maps. Suggestions use a static form declaration plus a JavaScript submission handler; hosted activation and delivery need separate verification.

## Case study

For the spreadsheet origin, pagination choices, map integration and development reflections, read [From spreadsheet to coffee directory](https://junosalathe.com/writing/beanfinder).

The earlier README narrative and historical Lighthouse capture remain in Git history. They describe earlier revisions and are not current validation results.

## Add or correct a roaster

Use the [suggestion form](https://beanfinder.coffee/submit/) or [open an issue](https://github.com/xdaybreakerx/beanfinder.coffee/issues).

## Data source

[This Google Sheet](https://docs.google.com/spreadsheets/d/e/2PACX-1vQMtPdz_le8HBLjTgAMK80IEoeZpZZGlZjcAdXh7Xd9Ld0Zy7zRV9duKyB7u_zHifi8nB9LiZogjXtb/pubhtml) (also by me)

## License

[MIT](LICENSE).
