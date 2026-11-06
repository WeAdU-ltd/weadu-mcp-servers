import assert from "node:assert/strict";
import test from "node:test";
import { auditUtmList, MAX_URLS } from "./audit-list.ts";
import { classifyChannel } from "./channels.ts";
import { normalizeMedium, normalizeSource, repairDecode } from "./normalize.ts";

const U = (q: string) => `https://example.com/p?${q}`;

test("GA4: canaux des règles manuelles", () => {
  assert.equal(classifyChannel("google", "cpc"), "Paid Search");
  assert.equal(classifyChannel("Google", "PPC"), "Paid Search");
  assert.equal(classifyChannel("facebook", "paid_social"), "Paid Social");
  assert.equal(classifyChannel("www.linkedin.com", "cpc"), "Paid Social");
  assert.equal(classifyChannel("youtube", "cpv"), "Paid Video");
  assert.equal(classifyChannel("amazon", "cpc"), "Paid Shopping");
  assert.equal(classifyChannel("partner", "cpc", "summer_shop"), "Paid Shopping");
  assert.equal(classifyChannel("x", "y", "my-cross-network-test"), "Cross-network");
  assert.equal(classifyChannel("gdn", "banner"), "Display");
  assert.equal(classifyChannel("partner", "cpm"), "Display");
  assert.equal(classifyChannel("partner", "retargeting"), "Paid Other");
  assert.equal(classifyChannel("linkedin", "social"), "Organic Social");
  assert.equal(classifyChannel("newsletter", "social-media"), "Organic Social");
  assert.equal(classifyChannel("vimeo", "post"), "Organic Video");
  assert.equal(classifyChannel("site", "webinar-video"), "Organic Video");
  assert.equal(classifyChannel("site", "organic"), "Organic Search");
  assert.equal(classifyChannel("chatgpt.com", "ai-assistant"), "AI Assistant");
  assert.equal(classifyChannel("blog", "referral"), "Referral");
  assert.equal(classifyChannel("hubspot", "email"), "Email");
  assert.equal(classifyChannel("e-mail", "whatever"), "Email");
  assert.equal(classifyChannel("partner", "affiliate"), "Affiliates");
  assert.equal(classifyChannel("spotify", "audio"), "Audio");
  assert.equal(classifyChannel("sms", "x"), "SMS");
  assert.equal(classifyChannel("app", "web-push"), "Mobile Push Notifications");
  assert.equal(classifyChannel("(direct)", "(none)"), "Direct");
  assert.equal(classifyChannel("hubspot", "newsletter"), "Unassigned");
  assert.equal(classifyChannel("partner", "affiliates"), "Unassigned");
});

test("Synonymes et réparation d'encodage", () => {
  assert.equal(normalizeSource(" LinkedIn "), "linkedin");
  assert.equal(normalizeSource("lnkd"), "linkedin");
  assert.equal(normalizeSource("FB"), "fb");
  assert.equal(normalizeSource("acme"), "acme");
  assert.equal(normalizeMedium("PPC"), "cpc");
  assert.equal(normalizeMedium("paid"), "paid");
  assert.equal(normalizeMedium("sem"), "sem");
  assert.equal(normalizeMedium("Social-Media"), "social");
  assert.equal(repairDecode("50%off"), "50%off");
  assert.equal(repairDecode("caf%E9"), "café");
  assert.equal(repairDecode("a+b%20c"), "a+b c");
  assert.equal(repairDecode("C++"), "C++");
});

test("Liste: URL corrigée, canal, doublons et synonymes", () => {
  const r = auditUtmList([
    U("utm_source=LinkedIn&utm_medium=PPC&utm_campaign=Spring"),
    U("utm_source=lnkd&utm_medium=cpc&utm_campaign=spring"),
    U("utm_source=linkedin&utm_medium=cpc&utm_campaign=spring"),
    U("utm_source=linkedin&utm_medium=cpc&utm_campaign=spring"),
    U("utm_source=hubspot&utm_medium=newsletter&utm_campaign=oct"),
    "not a url",
  ]);
  const [a, b, c, d, e, f] = r.items;
  assert.equal(a?.cleanedUrl, U("utm_source=linkedin&utm_medium=ppc&utm_campaign=spring"));
  assert.equal(a?.changed, true);
  assert.equal(a?.ga4.channel, "Paid Social");
  assert.equal(a?.namingSuggestions.find((s) => s.param === "utm_medium")?.to, "cpc");
  assert.equal(b?.duplicateOf, null);
  assert.equal(b?.ga4.channel, "Paid Other");
  assert.equal(b?.namingSuggestions.find((s) => s.param === "utm_source")?.to, "linkedin");
  assert.equal(b?.namingSuggestions.find((s) => s.param === "utm_source")?.channelAfter, "Paid Social");
  assert.equal(c?.changed, false);
  assert.equal(d?.duplicateOf, 2);
  assert.ok(d?.findings.some((x) => x.code === "duplicate_url"));
  assert.equal(e?.ga4.channel, "Unassigned");
  const warn = e?.findings.find((x) => x.code === "ga4_unassigned");
  assert.equal(warn?.message.includes('"email"'), false);
  assert.equal(e?.cleanedUrl, U("utm_source=hubspot&utm_medium=newsletter&utm_campaign=oct"));
  assert.equal(e?.namingSuggestions.some((s) => s.to === "email"), false);
  assert.equal(f?.ok, false);
  assert.equal(f?.cleanedUrl, null);
  const src = r.synonyms.find((s) => s.param === "utm_source" && s.normalized === "linkedin");
  assert.deepEqual(src?.variants.map((v) => v.value).sort(), ["LinkedIn", "linkedin", "lnkd"]);
  assert.ok(r.synonyms.some((s) => s.param === "utm_medium" && s.normalized === "cpc"));
  assert.equal(r.summary.total, 6);
  assert.equal(r.summary.duplicates, 1);
  assert.equal(r.summary.unassignedChannel, 1);
});

test("Liste: doublon exact signalé comme tel", () => {
  const url = U("utm_source=google&utm_medium=cpc&utm_campaign=a");
  const r = auditUtmList([url, url]);
  assert.ok(r.items[1]?.findings.some((x) => x.code === "duplicate_url"));
});

test("Liste: encodage réparé, paramètres non UTM conservés, UTM du fragment déplacés", () => {
  const r = auditUtmList([
    "https://example.com/?id=7&utm_source=google&utm_medium=cpc&utm_campaign=50%off",
    "https://example.com/?utm_source=google&utm_medium=cpc#utm_campaign=Promo",
    "https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=x&utm_campaign=y",
  ]);
  assert.equal(r.items[0]?.cleanedUrl, "https://example.com/?id=7&utm_source=google&utm_medium=cpc&utm_campaign=50%25off");
  assert.equal(r.items[1]?.cleanedUrl, "https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=promo");
  assert.equal(r.items[2]?.cleanedUrl, "https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=x");
});

test("Liste: limites et entrées vides", () => {
  assert.equal(auditUtmList([]).summary.total, 0);
  const many = Array.from({ length: MAX_URLS + 3 }, (_, i) => U(`utm_source=google&utm_medium=cpc&utm_campaign=c${i}`));
  const t0 = Date.now();
  const r = auditUtmList(many);
  assert.equal(r.items.length, MAX_URLS);
  assert.equal(r.truncated, true);
  assert.equal(r.summary.duplicates, 0);
  assert.ok(Date.now() - t0 < 5000);
});

test("Liste: ordre des paramètres conservé, '??' réparé", () => {
  const r = auditUtmList([
    "https://example.com/?utm_source=Twitter&linkId=9&utm_medium=social&utm_campaign=a",
    "https://example.com/??utm_source=blog&utm_medium=referral&utm_campaign=a",
  ]);
  assert.equal(r.items[0]?.cleanedUrl, "https://example.com/?utm_source=twitter&linkId=9&utm_medium=social&utm_campaign=a");
  assert.equal(r.items[1]?.cleanedUrl, "https://example.com/?utm_source=blog&utm_medium=referral&utm_campaign=a");
  assert.equal(r.items[1]?.ok, false);
});

test("Encodage mixte UTF-8 + Latin-1", () => {
  assert.equal(repairDecode("caf%C3%A9%E9"), "caféé");
  assert.equal(repairDecode("%E9t%C3%A9"), "été");
  assert.equal(repairDecode("%C3"), "Ã");
  assert.equal(repairDecode("%E2%82%AC%FF"), "€ÿ");
});
