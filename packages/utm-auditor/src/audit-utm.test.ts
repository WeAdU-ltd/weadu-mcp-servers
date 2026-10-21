import assert from "node:assert/strict";
import test from "node:test";
import { auditUtm, type AuditUtmResult, type UtmFindingCode } from "./audit-utm.ts";

const BASE = "https://example.com/path";
const REQ = "utm_source=google&utm_medium=cpc&utm_campaign=spring";

function codes(result: AuditUtmResult): UtmFindingCode[] {
  return result.findings.map((finding) => finding.code);
}

function has(result: AuditUtmResult, code: UtmFindingCode, param?: string): boolean {
  return result.findings.some((f) => f.code === code && (param === undefined || f.param === param));
}

test("1. URL complète", () => {
  const r = auditUtm(`${BASE}?${REQ}`);
  assert.equal(r.ok, true);
  assert.deepEqual(r.findings, []);
  assert.equal(r.present.utm_source, "google");
  assert.equal(r.canonicalUrl, `${BASE}?${REQ}`);
  assert.deepEqual(r.weadu, { name: "WeAdU", url: "https://weadu.com/" });
});

test("2. utm_campaign manquant", () => {
  const r = auditUtm(`${BASE}?utm_source=google&utm_medium=cpc`);
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), ["missing_required"]);
  assert.equal(r.findings[0]?.param, "utm_campaign");
});

test("3. valeur vide", () => {
  const r = auditUtm(`${BASE}?utm_source=&utm_medium=cpc&utm_campaign=spring`);
  assert.equal(r.ok, false);
  assert.ok(has(r, "empty_value", "utm_source"));
  const bare = auditUtm(`${BASE}?utm_source&utm_medium=cpc&utm_campaign=spring`);
  assert.ok(has(bare, "empty_value", "utm_source"));
});

test("4. espace en tête", () => {
  const r = auditUtm(`${BASE}?utm_source=google&utm_medium=%20cpc&utm_campaign=spring`);
  assert.equal(r.ok, false);
  assert.ok(has(r, "whitespace", "utm_medium"));
  assert.equal(r.present.utm_medium, " cpc");
});

test("5. clé en double", () => {
  const r = auditUtm(`${BASE}?utm_source=a&utm_source=b&utm_medium=cpc&utm_campaign=spring`);
  assert.equal(r.ok, false);
  assert.ok(has(r, "duplicate_key", "utm_source"));
  assert.equal(r.present.utm_source, "a");
});

test("6. clé utm inconnue", () => {
  const r = auditUtm(`${BASE}?${REQ}&utm_foo=1`);
  assert.equal(r.ok, true);
  assert.deepEqual(codes(r), ["unknown_utm"]);
  assert.equal(r.findings[0]?.severity, "warning");
  assert.equal(r.findings[0]?.param, "utm_foo");
});

test("7. UTM dans le fragment", () => {
  const r = auditUtm("https://example.com/#utm_source=x");
  assert.equal(r.ok, false);
  assert.ok(has(r, "missing_required", "utm_source"));
  assert.ok(has(r, "fragment_utm", "utm_source"));
  assert.deepEqual(r.present, {});
  assert.equal(r.canonicalUrl, "https://example.com/");
});

test("8. protocole non http", () => {
  const r = auditUtm("ftp://example.com/?utm_source=a&utm_medium=b&utm_campaign=c");
  assert.equal(r.ok, false);
  assert.ok(has(r, "not_http"));
  assert.equal(r.canonicalUrl, null);
});

test("9. valeur trop longue", () => {
  const r = auditUtm(`${BASE}?utm_source=a&utm_medium=b&utm_campaign=${"x".repeat(201)}`);
  assert.equal(r.ok, false);
  assert.ok(has(r, "value_too_long", "utm_campaign"));
  const limit = auditUtm(`${BASE}?utm_source=a&utm_medium=b&utm_campaign=${"x".repeat(200)}`);
  assert.equal(limit.ok, true);
});

test("10. identifiants dans l'URL", () => {
  const r = auditUtm("https://user:pass@example.com/?utm_source=a&utm_medium=b&utm_campaign=c");
  assert.equal(r.ok, false);
  assert.ok(has(r, "userinfo"));
  assert.equal(r.canonicalUrl, null);
});

test("11. pas une URL", () => {
  assert.doesNotThrow(() => auditUtm("not a url"));
  const r = auditUtm("not a url");
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), ["invalid_url"]);
  assert.equal(r.canonicalUrl, null);
  assert.deepEqual(codes(auditUtm("   ")), ["invalid_url"]);
  assert.deepEqual(codes(auditUtm(undefined as unknown as string)), ["invalid_url"]);
});

test("12. casse des clés", () => {
  const r = auditUtm(`${BASE}?UTM_SOURCE=Google&utm_medium=cpc&utm_campaign=spring`);
  assert.equal(r.ok, true);
  assert.equal(r.present.utm_source, "Google");
});

test("cas limites : encodage invalide et paramètres non UTM répétés", () => {
  const r = auditUtm(`${BASE}?${REQ}&utm_content=%E0%A4%A&color=red&color=blue`);
  assert.equal(r.ok, true);
  assert.equal(r.present.utm_content, "%E0%A4%A");
});

test("22. valeurs en majuscules : avertissement mixed_case_value", () => {
  const r = auditUtm(`${BASE}?utm_source=LinkedIn&utm_medium=social&utm_campaign=Test`);
  assert.equal(r.ok, true);
  assert.deepEqual(codes(r), ["mixed_case_value", "mixed_case_value"]);
  assert.ok(has(r, "mixed_case_value", "utm_source"));
  assert.ok(has(r, "mixed_case_value", "utm_campaign"));
  assert.equal(has(r, "mixed_case_value", "utm_medium"), false);
  const digits = auditUtm(`${BASE}?utm_source=google&utm_medium=cpc&utm_campaign=2026-q4_%C3%A9t%C3%A9`);
  assert.deepEqual(digits.findings, []);
});

test("23. % mal encodé : avertissement malformed_encoding", () => {
  const r = auditUtm(`${BASE}?utm_source=linked%ZZin&utm_medium=cpc&utm_campaign=te%2`);
  assert.equal(r.ok, true);
  assert.ok(has(r, "malformed_encoding", "utm_source"));
  assert.ok(has(r, "malformed_encoding", "utm_campaign"));
  assert.equal(has(r, "mixed_case_value"), false);
  const trailing = auditUtm(`${BASE}?utm_source=google&utm_medium=cpc&utm_campaign=sale%`);
  assert.ok(has(trailing, "malformed_encoding", "utm_campaign"));
  const badUtf8 = auditUtm(`${BASE}?utm_source=google&utm_medium=cpc&utm_campaign=%C3`);
  assert.ok(has(badUtf8, "malformed_encoding", "utm_campaign"));
  const ok = auditUtm(`${BASE}?utm_source=google&utm_medium=cpc&utm_campaign=50%25%20off`);
  assert.deepEqual(ok.findings, []);
});
