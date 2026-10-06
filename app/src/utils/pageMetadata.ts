export const CANONICAL_ORIGIN = "https://beanfinder.coffee";
const pages: Record<string, { title: string; description: string }> = {
  "/": { title: "BeanFinder · Australian coffee roasters", description: "Discover Australian coffee roasters, find a cafe nearby and compare multi-roaster subscriptions." },
  "/roasters/": { title: "Coffee directory · BeanFinder", description: "Search Australian coffee roasters by name, state and cafe availability, with Google Maps ratings and location links." },
  "/map/": { title: "Coffee map · BeanFinder", description: "Find Australian cafe and roaster locations on the map. Search a suburb or town and get directions." },
  "/submit/": { title: "Suggest a roaster · BeanFinder", description: "Recommend an Australian coffee roaster or suggest a correction to the BeanFinder directory." },
  "/privacy/": { title: "Privacy · BeanFinder", description: "How BeanFinder handles submissions, Google Maps and browser storage." },
  "/terms/": { title: "Terms of use · BeanFinder", description: "Using BeanFinder's curated coffee directory, location information and Google Maps features." },
};
export function pageMetadata(path: string) {
  const pathname = path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
  const seller = /^\/roasters\/online-subscriptions\/\d+\/$/.test(pathname);
  return { ...(seller ? { title: "Multi-roaster sellers · BeanFinder", description: "Compare Australian multi-roaster sellers and subscriptions, including selection options and filter, espresso and decaf beans." }
    : pages[pathname] ?? { title: "BeanFinder", description: "Explore Australian coffee roasters with BeanFinder." }),
    canonical: new URL(pathname, CANONICAL_ORIGIN).href,
    noindex: pathname === "/success/" || pathname === "/404/" };
}
