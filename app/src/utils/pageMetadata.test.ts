import { expect, it } from "vitest";
import { pageMetadata } from "./pageMetadata";
it("uses the apex canonical origin, normalizes slashes and distinguishes route metadata", () => {
  const routes = ["/", "/roasters/", "/map", "/submit/", "/privacy/", "/terms/", "/roasters/online-subscriptions/1"];
  const titles = routes.map(path => pageMetadata(path).title);
  expect(new Set(titles).size).toBe(routes.length);
  expect(pageMetadata("/map").canonical).toBe("https://beanfinder.coffee/map/");
  expect(pageMetadata("/success/").noindex).toBe(true);
  expect(pageMetadata("/404").noindex).toBe(true);
  expect(pageMetadata("/roasters/").noindex).toBe(false);
});
