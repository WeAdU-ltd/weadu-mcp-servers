import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { auditUtm } from "./audit-utm.ts";
import { auditUtmList } from "./audit-list.ts";
import { classifyChannel } from "./channels.ts";
import { GA4_CAVEATS, AUDIT_LIST_DESCRIPTION, AUDIT_UTM_DESCRIPTION } from "./ga4-copy.ts";
import { SEARCH, SHOPPING, SOCIAL, VIDEO } from "./ga4-sources.ts";

const U = (query: string) => `https://ex.com/?${query}`;

function caveats(text: string): void {
  assert.match(text, /Manual traffic only/);
  assert.match(text, /auto-tagging is on by default/);
  assert.match(text, /Performance Max and Demand Gen are Cross-network/);
  assert.match(text, /Display is Display/);
  assert.match(text, /Video is Paid Video/);
  assert.match(text, /Shopping is Paid Shopping/);
  assert.match(text, /gclid, wbraid, gbraid and dclid are not read/);
}

test("les trois limites sont sur audit_utm, sur la liste, et dans les descriptions", () => {
  const url = U("utm_source=google&utm_medium=cpc&utm_campaign=brand");
  const one = auditUtm(url);
  const list = auditUtmList([url]);
  caveats(one.ga4.caveats.join(" "));
  caveats(list.ga4Caveats.join(" "));
  caveats(list.items[0]!.ga4.caveats.join(" "));
  assert.equal(one.ga4.scope, "manual_traffic");
  assert.equal(list.items[0]!.ga4.scope, "manual_traffic");
  assert.equal(one.ga4.channel, list.items[0]!.ga4.channel);
  caveats(AUDIT_UTM_DESCRIPTION);
  caveats(AUDIT_LIST_DESCRIPTION);
  const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.match(index, /AUDIT_UTM_DESCRIPTION/);
  assert.match(index, /AUDIT_LIST_DESCRIPTION/);
  assert.deepEqual(GA4_CAVEATS.length, 3);
});

test("matrice : Performance Max, Display, Shopping, Video, gclid", () => {
  const pmax = auditUtm(U("utm_source=google&utm_medium=cpc&utm_campaign=pmax_q4"));
  assert.equal(pmax.ga4.channel, "Paid Search");
  assert.equal(pmax.ok, true);
  caveats(pmax.ga4.caveats.join(" "));
  assert.equal(pmax.findings.some((f) => f.code === "click_id"), false);

  const display = auditUtm(U("utm_source=google&utm_medium=cpc&utm_campaign=display_remarketing"));
  assert.equal(display.ga4.channel, "Paid Search");
  caveats(display.ga4.caveats.join(" "));
  const displayMedium = auditUtm(U("utm_source=gdn&utm_medium=display&utm_campaign=remarketing"));
  assert.equal(displayMedium.ga4.channel, "Display");

  const shoppingName = auditUtm(U("utm_source=google&utm_medium=cpc&utm_campaign=brand"));
  assert.equal(shoppingName.ga4.channel, "Paid Search");
  const shoppingSource = auditUtm(U("utm_source=amazon&utm_medium=cpc&utm_campaign=a"));
  assert.equal(shoppingSource.ga4.channel, "Paid Shopping");

  const videoName = auditUtm(U("utm_source=google&utm_medium=cpc&utm_campaign=video_ads"));
  assert.equal(videoName.ga4.channel, "Paid Search");
  const videoSource = auditUtm(U("utm_source=youtube&utm_medium=cpc&utm_campaign=video_ads"));
  assert.equal(videoSource.ga4.channel, "Paid Video");

  const gclid = auditUtm(U("utm_source=google&utm_medium=cpc&utm_campaign=brand&gclid=TeSt"));
  assert.equal(gclid.ga4.channel, "Paid Search");
  assert.equal(gclid.ok, true);
  const click = gclid.findings.find((f) => f.code === "click_id");
  assert.ok(click);
  assert.match(click!.message, /gclid/);
  assert.match(click!.message, /not read/);
  assert.match(gclid.cleanedUrl ?? "", /gclid=TeSt/);
});

test("matrice : google/email, google/sms, google/sem, text, C++, newsletter", () => {
  const email = auditUtm(U("utm_source=google&utm_medium=email&utm_campaign=n"));
  assert.equal(email.ga4.channel, "Organic Search");
  assert.ok(email.ga4.notes.some((note) => note.includes("before Email and SMS")));
  assert.equal(email.cleanedUrl, U("utm_source=google&utm_medium=email&utm_campaign=n"));

  const sms = auditUtm(U("utm_source=google&utm_medium=sms&utm_campaign=a"));
  assert.equal(sms.ga4.channel, "Organic Search");
  assert.ok(sms.ga4.notes.some((note) => note.includes("before Email and SMS")));

  const sem = auditUtm(U("utm_source=google&utm_medium=sem&utm_campaign=brand"));
  assert.equal(sem.ga4.channel, "Organic Search");
  assert.equal(sem.cleanedUrl, U("utm_source=google&utm_medium=sem&utm_campaign=brand"));
  assert.equal(sem.namingSuggestions.some((s) => s.to === "cpc"), false);
  assert.ok(sem.ga4.notes.some((note) => note.includes("does not rewrite it to cpc")));
  const adwords = auditUtm(U("utm_source=google&utm_medium=adwords&utm_campaign=brand"));
  assert.equal(adwords.cleanedUrl, U("utm_source=google&utm_medium=adwords&utm_campaign=brand"));
  assert.equal(adwords.namingSuggestions.some((s) => s.to === "cpc"), false);

  const textAds = auditUtm(U("utm_source=google&utm_medium=text&utm_campaign=a"));
  assert.equal(textAds.ga4.channel, "Organic Search");
  assert.equal(textAds.cleanedUrl, U("utm_source=google&utm_medium=text&utm_campaign=a"));
  assert.equal(textAds.namingSuggestions.some((s) => s.to === "sms"), false);
  const textCrm = auditUtm(U("utm_source=klaviyo&utm_medium=text&utm_campaign=a"));
  assert.equal(textCrm.ga4.channel, "Unassigned");
  assert.equal(textCrm.cleanedUrl, U("utm_source=klaviyo&utm_medium=text&utm_campaign=a"));
  assert.equal(textCrm.findings.some((f) => f.message.includes("sms")), false);

  const plus = auditUtm(U("utm_source=google&utm_medium=cpc&utm_campaign=C++"));
  assert.equal(plus.cleanedUrl, U("utm_source=google&utm_medium=cpc&utm_campaign=c%2B%2B"));
  assert.equal(plus.cleanedUrl?.endsWith("utm_campaign=c"), false);
  const encodedPlus = auditUtm(U("utm_source=google&utm_medium=cpc&utm_campaign=C%2B%2B"));
  assert.equal(encodedPlus.cleanedUrl, U("utm_source=google&utm_medium=cpc&utm_campaign=c%2B%2B"));
  const googleAds = auditUtm(U("utm_source=google+ads&utm_medium=cpc&utm_campaign=a"));
  assert.match(googleAds.cleanedUrl ?? "", /utm_source=google%2Bads/);
  assert.equal(googleAds.cleanedUrl?.includes("google%20ads"), false);
  assert.equal(googleAds.ga4.channel, "Paid Other");

  const newsletter = auditUtm(U("utm_source=hubspot&utm_medium=newsletter&utm_campaign=oct"));
  assert.equal(newsletter.ga4.channel, "Unassigned");
  assert.equal(newsletter.cleanedUrl, U("utm_source=hubspot&utm_medium=newsletter&utm_campaign=oct"));
  assert.equal(newsletter.namingSuggestions.some((s) => s.to === "email"), false);
  assert.equal(newsletter.findings.some((f) => f.message.includes('Use "email"')), false);
});

test("matrice : x.com, rakuten, fragment, doublon, utm_source_platform", () => {
  const xcom = auditUtm(U("utm_source=x.com&utm_medium=cpc&utm_campaign=a"));
  assert.equal(xcom.ga4.channel, "Paid Other");
  assert.equal(xcom.cleanedUrl, U("utm_source=x.com&utm_medium=cpc&utm_campaign=a"));
  assert.equal(xcom.namingSuggestions.some((s) => s.to === "twitter"), false);

  const rakuten = auditUtm(U("utm_source=rakuten&utm_medium=cpc&utm_campaign=a"));
  assert.equal(rakuten.ga4.channel, "Paid Search");
  assert.equal(rakuten.namingSuggestions.length, 0);

  const fragment = auditUtm("https://ex.com/landing#utm_source=newsletter&utm_medium=email&utm_campaign=Promo");
  assert.equal(fragment.cleanedUrl, "https://ex.com/landing?utm_source=newsletter&utm_medium=email&utm_campaign=promo");
  assert.ok(fragment.findings.some((f) => f.code === "fragment_utm"));
  const route = auditUtm("https://ex.com/app#/dashboard?utm_source=google&utm_medium=cpc&utm_campaign=a");
  assert.equal(route.cleanedUrl, "https://ex.com/app#/dashboard?utm_source=google&utm_medium=cpc&utm_campaign=a");
  assert.match(route.findings.find((f) => f.code === "fragment_utm")?.message ?? "", /route/);

  const dup = auditUtm(U("utm_source=google&utm_source=facebook&utm_medium=cpc&utm_campaign=a"));
  const dupFinding = dup.findings.find((f) => f.code === "duplicate_key");
  assert.match(dupFinding?.message ?? "", /keeps the first value/);
  assert.match(dupFinding?.message ?? "", /independent tests report the last/);
  assert.equal(dup.cleanedUrl, U("utm_source=google&utm_medium=cpc&utm_campaign=a"));
  assert.equal(dup.ga4.channel, "Paid Search");

  const first = "https://ex.com/?utm_source=google&utm_medium=cpc&utm_campaign=a&gclid=1";
  const reordered = "https://ex.com/?gclid=1&utm_campaign=a&utm_medium=cpc&utm_source=google";
  const hashed = `${first}#section`;
  const cased = "https://ex.com/?utm_source=Google&utm_medium=cpc&utm_campaign=a&gclid=1";
  const list = auditUtmList([first, reordered, hashed, cased]);
  assert.equal(list.items[1]?.findings.find((f) => f.code === "equivalent_url")?.message.includes("split"), false);
  assert.match(list.items[1]?.findings.find((f) => f.code === "equivalent_url")?.message ?? "", /not their order|not the parameter order|Parameter order/);
  assert.equal(list.items[2]?.findings.some((f) => f.code === "equivalent_url"), true);
  assert.equal(list.items[2]?.findings.some((f) => f.code === "variant_url"), false);
  assert.match(list.items[3]?.findings.find((f) => f.code === "variant_url")?.message ?? "", /separate rows/);

  const platform = auditUtm(
    U("utm_source=google&utm_medium=cpc&utm_campaign=a&utm_source_platform=SA360&utm_creative_format=display&utm_marketing_tactic=prospecting&utm_id=Ab12"),
  );
  assert.equal(platform.findings.some((f) => f.code === "unknown_utm"), false);
  assert.ok(platform.findings.some((f) => f.code === "unreported_utm" && f.param === "utm_creative_format"));
  assert.ok(platform.findings.some((f) => f.code === "unreported_utm" && f.param === "utm_marketing_tactic"));
  assert.match(platform.findings.find((f) => f.param === "utm_creative_format")?.message ?? "", /not currently reported/);
  assert.match(platform.cleanedUrl ?? "", /utm_source_platform=SA360/);
  assert.match(platform.cleanedUrl ?? "", /utm_id=Ab12/);
  assert.equal(platform.cleanedUrl?.includes("utm_source_platform=sa360"), false);
});

test("réécritures retirées, suggestions encore séparées de l'URL nettoyée", () => {
  const cases: Array<[string, string]> = [
    [U("utm_source=fb&utm_medium=cpc&utm_campaign=a"), "facebook"],
    [U("utm_source=insta&utm_medium=cpc&utm_campaign=a"), "instagram"],
    [U("utm_source=li&utm_medium=cpc&utm_campaign=a"), "linkedin"],
    [U("utm_source=pin&utm_medium=cpc&utm_campaign=a"), "pinterest"],
    [U("utm_source=x&utm_medium=cpc&utm_campaign=a"), "twitter"],
    [U("utm_source=klaviyo&utm_medium=txt&utm_campaign=a"), "sms"],
    [U("utm_source=blog&utm_medium=seo&utm_campaign=a"), "organic"],
    [U("utm_source=facebook&utm_medium=paid&utm_campaign=a"), "cpc"],
  ];
  for (const [url, forbidden] of cases) {
    const result = auditUtm(url);
    assert.equal(result.namingSuggestions.some((s) => s.to === forbidden), false, url);
    assert.equal(result.cleanedUrl?.includes(`=${forbidden}&`) || result.cleanedUrl?.endsWith(`=${forbidden}`), false, result.cleanedUrl);
  }
  assert.equal(auditUtm(U("utm_source=fb&utm_medium=cpc&utm_campaign=a")).ga4.channel, "Paid Social");
  assert.equal(auditUtm(U("utm_source=insta&utm_medium=cpc&utm_campaign=a")).ga4.channel, "Paid Other");
  assert.equal(auditUtm(U("utm_source=facebook&utm_medium=paid&utm_campaign=a")).ga4.channel, "Paid Social");
  assert.equal(auditUtm(U("utm_source=facebook&utm_medium=paid&utm_campaign=a")).cleanedUrl?.includes("utm_medium=paid"), true);

  const ppc = auditUtm(U("utm_source=linkedin&utm_medium=ppc&utm_campaign=a"));
  const suggestion = ppc.namingSuggestions.find((s) => s.param === "utm_medium");
  assert.equal(suggestion?.from, "ppc");
  assert.equal(suggestion?.to, "cpc");
  assert.equal(suggestion?.channelBefore, "Paid Social");
  assert.equal(suggestion?.channelAfter, "Paid Social");
  assert.match(ppc.cleanedUrl ?? "", /utm_medium=ppc/);

  const affiliates = auditUtm(U("utm_source=partner&utm_medium=affiliates&utm_campaign=a"));
  assert.equal(affiliates.ga4.channel, "Unassigned");
  assert.equal(affiliates.cleanedUrl?.includes("utm_medium=affiliates"), true);
  const aff = affiliates.namingSuggestions.find((s) => s.param === "utm_medium");
  assert.equal(aff?.to, "affiliate");
  assert.equal(aff?.channelBefore, "Unassigned");
  assert.equal(aff?.channelAfter, "Affiliates");
});

test("pièges d'ordre des règles et sources du fichier Google", () => {
  const shop = auditUtm(U("utm_source=hubspot&utm_medium=email&utm_campaign=black_friday_shopping"));
  assert.equal(shop.ga4.channel, "Organic Shopping");
  assert.ok(shop.ga4.notes.some((note) => note.includes("shop/shopping")));

  const auto = auditUtm(U("utm_source=partner&utm_medium=automobile&utm_campaign=a"));
  assert.equal(auto.ga4.channel, "Mobile Push Notifications");
  assert.ok(auto.ga4.notes.some((note) => note.includes("mobile")));

  assert.equal(classifyChannel("discord", "referral"), "Referral");
  assert.equal(classifyChannel("discord", "cpc"), "Paid Other");
  assert.equal(classifyChannel("slack", "referral"), "Referral");
  assert.equal(classifyChannel("news.ycombinator.com", "referral"), "Organic Social");
  assert.equal(classifyChannel("ecosia", "cpc"), "Paid Other");
  assert.equal(classifyChannel("ecosia.org", "cpc"), "Paid Search");
  assert.equal(classifyChannel("aliexpress", "referral"), "Referral");
  assert.equal(classifyChannel("youtu.be", "cpc"), "Paid Other");
  assert.equal(classifyChannel("youtube", "cpc"), "Paid Video");
  assert.equal(classifyChannel("rakuten", "cpc"), "Paid Search");
  assert.equal(classifyChannel("x.com", "cpc"), "Paid Other");
  assert.equal(classifyChannel("google.evil.com", "cpc"), "Paid Other");
  assert.equal(classifyChannel("www.linkedin.com", "cpc"), "Paid Social");
  assert.equal(classifyChannel("Google Shopping", "cpc"), "Paid Shopping");

  const youtu = auditUtm(U("utm_source=youtu.be&utm_medium=cpc&utm_campaign=a"));
  assert.equal(youtu.cleanedUrl, U("utm_source=youtu.be&utm_medium=cpc&utm_campaign=a"));
  assert.equal(youtu.namingSuggestions.find((s) => s.param === "utm_source")?.to, "youtube");
  assert.equal(youtu.namingSuggestions.find((s) => s.param === "utm_source")?.channelBefore, "Paid Other");
  assert.equal(youtu.namingSuggestions.find((s) => s.param === "utm_source")?.channelAfter, "Paid Video");

  assert.equal(SEARCH.has("rakuten"), true);
  assert.equal(SHOPPING.has("rakuten"), false);
  assert.equal(SOCIAL.has("x.com"), false);
  assert.equal(SOCIAL.has("discord"), false);
  assert.equal(SOCIAL.has("fb"), true);
  assert.equal(SOCIAL.has("tiktok"), true);
  assert.equal(VIDEO.has("tiktok"), false);
  assert.equal(VIDEO.has("youtu.be"), false);
  assert.equal(SEARCH.size, 129);
  assert.equal(SOCIAL.size, 592);
  assert.equal(VIDEO.size, 46);
  assert.equal(SHOPPING.size, 52);
});

test("encodage : % mal formé et UTF-8 invalide n'ont pas le même message", () => {
  const broken = auditUtm(U("utm_source=linked%ZZin&utm_medium=cpc&utm_campaign=te%"));
  assert.match(broken.findings.find((f) => f.param === "utm_source")?.message ?? "", /not followed by two hex digits/);
  const utf8 = auditUtm(U("utm_source=google&utm_medium=cpc&utm_campaign=%E9"));
  const message = utf8.findings.find((f) => f.code === "malformed_encoding")?.message ?? "";
  assert.match(message, /not valid UTF-8/);
  assert.equal(message.includes("not followed by two hex digits"), false);
  assert.equal(utf8.cleanedUrl, U("utm_source=google&utm_medium=cpc&utm_campaign=%C3%A9"));
});

test("README et zod : vie privée, canaux manuels, correctif de sécurité", () => {
  const en = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const fr = readFileSync(new URL("../README.fr.md", import.meta.url), "utf8");
  for (const readme of [en, fr]) {
    assert.match(readme, /no network calls|aucun appel réseau/);
    assert.match(readme, /model provider|fournisseur du modèle/);
    assert.match(readme, /auto-tagging|auto-tagging|auto-tagué|automatique/);
    assert.match(readme, /gclid/);
    assert.equal(readme.includes("never leave your machine"), false);
    assert.equal(readme.includes("ne quittent jamais"), false);
  }
  for (const file of ["../package.json", "../../ai-visibility/package.json"]) {
    const pkg = JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8")) as { dependencies: { zod: string } };
    const [major, minor, patch] = pkg.dependencies.zod.split(".").map(Number);
    assert.ok(major! > 4 || (major === 4 && (minor! > 6 || (minor === 6 && patch! >= 6))), file);
  }
  const lock = readFileSync(new URL("../../../package-lock.json", import.meta.url), "utf8");
  assert.match(lock, /body-parser-2\.4\.0\.tgz/);
  assert.match(AUDIT_LIST_DESCRIPTION, /truncated: true/);
});
