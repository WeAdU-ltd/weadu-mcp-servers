import assert from "node:assert/strict";
import test from "node:test";
import { extractSignals } from "./signals.ts";

test("signaux HTML", () => {
  const html = `<html><head><TITLE> A &amp; <b>B</b>
  </TITLE><meta name="description" content="Desc"><meta name='robots' content='index'>
  <link rel="alternate canonical" href="https://example.com/c">
  <script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":["WebSite","Organization"]}]}</script>
  </head></html>`;
  assert.deepEqual(extractSignals(html, null), {
    title: "A & B",
    hasMetaDescription: true,
    metaRobots: "index",
    canonical: "https://example.com/c",
    jsonLdTypes: ["Organization", "WebSite"],
    noindex: false,
  });
});

test("9. JSON-LD invalide ignoré", () => {
  const html = '<script type="application/ld+json">{oops</script>';
  assert.doesNotThrow(() => extractSignals(html, null));
  assert.deepEqual(extractSignals(html, null).jsonLdTypes, []);
});

test("noindex par meta ou x-robots-tag, titre absent ou tronqué", () => {
  assert.equal(extractSignals('<meta name="robots" content="NOINDEX">', null).noindex, true);
  assert.equal(extractSignals("<p>x</p>", "noindex, nofollow").noindex, true);
  const empty = extractSignals("", null);
  assert.equal(empty.title, null);
  assert.equal(empty.hasMetaDescription, false);
  assert.equal(empty.metaRobots, null);
  assert.equal(empty.canonical, null);
  assert.equal(extractSignals(`<title>${"x".repeat(300)}</title>`, null).title?.length, 200);
  assert.equal(extractSignals('<meta name="description" content="  ">', null).hasMetaDescription, false);
});
