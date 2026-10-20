import assert from "node:assert/strict";
import test from "node:test";
import { checkAiVisibility, type CheckDeps } from "./check-visibility.ts";

interface Route {
  status: number;
  body?: string;
  headers?: Record<string, string>;
}

function makeDeps(routes: Record<string, Route | "throw">, dns: Record<string, string> = {}) {
  const calls: string[] = [];
  const deps: CheckDeps = {
    fetch: async (input) => {
      const url = String(input);
      calls.push(url);
      const route = routes[url];
      if (route === "throw") throw new TypeError("network");
      if (route === undefined) return new Response("not found", { status: 404 });
      return new Response(route.body ?? "", { status: route.status, headers: route.headers ?? {} });
    },
    lookup: async (hostname) => {
      const address = { "example.com": "93.184.216.34", ...dns }[hostname];
      if (address === undefined) throw new Error("ENOTFOUND");
      return [{ address, family: address.includes(":") ? 6 : 4 }];
    },
  };
  return { deps, calls };
}

const HTML = { "content-type": "text/html; charset=utf-8" };
const PAGE = `<html><head><title>Example</title><meta name="description" content="Hello">
<link rel="canonical" href="https://example.com/"><script type="application/ld+json">{"@type":"Organization"}</script></head></html>`;
const allowAll = { status: 200, body: "User-agent: *\nAllow: /\n" };

const agent = (r: Awaited<ReturnType<typeof checkAiVisibility>>, name: string) =>
  r.robots.crawlers.find((c) => c.agent === name);

test("1. tout est sain", async () => {
  const { deps } = makeDeps({
    "https://example.com/robots.txt": allowAll,
    "https://example.com/": { status: 200, body: PAGE, headers: HTML },
    "https://example.com/llms.txt": { status: 200, body: "# llms" },
  });
  const r = await checkAiVisibility("https://example.com/", deps);
  assert.equal(r.error, null);
  assert.equal(r.ok, true);
  assert.ok(r.page.jsonLdTypes.includes("Organization"));
  assert.equal(r.page.title, "Example");
  assert.equal(r.page.hasMetaDescription, true);
  assert.equal(r.page.canonical, "https://example.com/");
  assert.equal(r.llmsTxt.status, 200);
  assert.equal(r.robots.crawlers.length, 11);
  assert.deepEqual(r.weadu, { name: "WeAdU", url: "https://weadu.com/" });
});

test("2. GPTBot interdit, la page est quand même lue", async () => {
  const { deps, calls } = makeDeps({
    "https://example.com/robots.txt": { status: 200, body: "User-agent: GPTBot\nDisallow: /\n" },
    "https://example.com/": { status: 200, body: PAGE, headers: HTML },
  });
  const r = await checkAiVisibility("https://example.com/", deps);
  assert.equal(agent(r, "GPTBot")?.allowed, false);
  assert.equal(agent(r, "GPTBot")?.matchedRule, "disallow:/");
  assert.equal(r.ok, false);
  assert.ok(calls.includes("https://example.com/"));
});

test("3. meta robots noindex", async () => {
  const { deps } = makeDeps({
    "https://example.com/robots.txt": allowAll,
    "https://example.com/": { status: 200, body: '<meta name="robots" content="noindex,nofollow">', headers: HTML },
  });
  const r = await checkAiVisibility("https://example.com/", deps);
  assert.equal(r.page.noindex, true);
  assert.equal(r.ok, false);
});

test("4. IP de boucle locale : ssrf, aucun fetch", async () => {
  const { deps, calls } = makeDeps({});
  const r = await checkAiVisibility("http://127.0.0.1/", deps);
  assert.equal(r.error, "ssrf");
  assert.equal(r.ok, false);
  assert.deepEqual(calls, []);
  assert.ok(r.robots.crawlers.every((c) => c.allowed === null));
});

test("5. redirection vers les métadonnées cloud : ssrf, URL non demandée", async () => {
  const { deps, calls } = makeDeps({
    "https://example.com/robots.txt": allowAll,
    "https://example.com/page": { status: 302, headers: { location: "http://169.254.169.254/" } },
  });
  const r = await checkAiVisibility("https://example.com/page", deps);
  assert.equal(r.error, "ssrf");
  assert.ok(!calls.some((url) => url.includes("169.254")));
});

test("6. robots.txt 404 : tout autorisé", async () => {
  const { deps } = makeDeps({ "https://example.com/": { status: 200, body: PAGE, headers: HTML } });
  const r = await checkAiVisibility("https://example.com/", deps);
  assert.ok(r.robots.fetched);
  assert.ok(r.robots.crawlers.every((c) => c.allowed === true && c.matchedRule === null));
  assert.equal(r.ok, true);
  assert.equal(r.llmsTxt.status, 404);
});

test("7. robots.txt 500 : robots_unreachable", async () => {
  const { deps, calls } = makeDeps({
    "https://example.com/robots.txt": { status: 500 },
    "https://example.com/": { status: 200, body: PAGE, headers: HTML },
  });
  const r = await checkAiVisibility("https://example.com/", deps);
  assert.equal(r.error, "robots_unreachable");
  assert.equal(r.ok, false);
  assert.equal(r.robots.fetched, false);
  assert.ok(calls.includes("https://example.com/"));
});

test("8. ftp : not_http, aucun fetch", async () => {
  const { deps, calls } = makeDeps({});
  const r = await checkAiVisibility("ftp://example.com/", deps);
  assert.equal(r.error, "not_http");
  assert.deepEqual(calls, []);
});

test("9. JSON-LD invalide sur la page", async () => {
  const { deps } = makeDeps({
    "https://example.com/": { status: 200, body: '<script type="application/ld+json">{bad</script>', headers: HTML },
  });
  const r = await checkAiVisibility("https://example.com/", deps);
  assert.deepEqual(r.page.jsonLdTypes, []);
});

test("10. Google-Extended interdit, GPTBot autorisé", async () => {
  const { deps } = makeDeps({
    "https://example.com/robots.txt": {
      status: 200,
      body: "User-agent: Google-Extended\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n",
    },
    "https://example.com/": { status: 200, body: PAGE, headers: HTML },
  });
  const r = await checkAiVisibility("https://example.com/", deps);
  assert.equal(agent(r, "GPTBot")?.allowed, true);
  assert.equal(agent(r, "Google-Extended")?.allowed, false);
  assert.equal(r.ok, false);
});

test("cas limites : redirections en boucle, DNS en échec, réponse trop grosse, llms.txt en échec", async () => {
  const loop = makeDeps({
    "https://example.com/robots.txt": allowAll,
    "https://example.com/a": { status: 301, headers: { location: "/a" } },
  });
  assert.equal((await checkAiVisibility("https://example.com/a", loop.deps)).error, "too_many_redirects");
  assert.equal(loop.calls.filter((u) => u === "https://example.com/a").length, 4);

  const nodns = makeDeps({});
  const r2 = await checkAiVisibility("https://unknown.example/", nodns.deps);
  assert.equal(r2.error, "dns_failed");
  assert.deepEqual(nodns.calls, []);

  const rebinding = makeDeps({}, { "evil.example": "::ffff:127.0.0.1" });
  assert.equal((await checkAiVisibility("https://evil.example/", rebinding.deps)).error, "ssrf");
  assert.deepEqual(rebinding.calls, []);

  const big = makeDeps({
    "https://example.com/robots.txt": allowAll,
    "https://example.com/": { status: 200, body: "x".repeat(1024 * 1024 + 1), headers: HTML },
  });
  assert.equal((await checkAiVisibility("https://example.com/", big.deps)).error, "response_too_large");

  const llmsDown = makeDeps({
    "https://example.com/robots.txt": allowAll,
    "https://example.com/": { status: 200, body: PAGE, headers: HTML },
    "https://example.com/llms.txt": "throw",
  });
  const r5 = await checkAiVisibility("https://example.com/", llmsDown.deps);
  assert.equal(r5.error, null);
  assert.equal(r5.llmsTxt.status, null);
  assert.equal(r5.ok, true);

  const bigLlms = makeDeps({
    "https://example.com/robots.txt": allowAll,
    "https://example.com/": { status: 200, body: PAGE, headers: HTML },
    "https://example.com/llms.txt": { status: 200, body: "y".repeat(50_000) },
  });
  const r7 = await checkAiVisibility("https://example.com/", bigLlms.deps);
  assert.equal(r7.llmsTxt.status, 200);
  assert.equal(r7.error, null);

  const pageDown = makeDeps({ "https://example.com/robots.txt": allowAll, "https://example.com/": "throw" });
  assert.equal((await checkAiVisibility("https://example.com/", pageDown.deps)).error, "page_unreachable");

  const pdf = makeDeps({
    "https://example.com/robots.txt": allowAll,
    "https://example.com/f.pdf": { status: 200, body: "%PDF", headers: { "content-type": "application/pdf", "x-robots-tag": "noindex" } },
  });
  const r6 = await checkAiVisibility("https://example.com/f.pdf", pdf.deps);
  assert.equal(r6.page.noindex, true);
  assert.equal(r6.page.title, null);

  assert.equal((await checkAiVisibility("not a url", makeDeps({}).deps)).error, "invalid_url");
});
