import assert from "node:assert/strict";
import test from "node:test";
import { guardUrl, isBlockedAddress } from "./guard.ts";

test("12. isBlockedAddress : privé bloqué, public autorisé", () => {
  assert.equal(isBlockedAddress("10.1.2.3"), true);
  assert.equal(isBlockedAddress("93.184.216.34"), false);
});

test("isBlockedAddress : plages IPv4 et IPv6 réservées", () => {
  for (const address of [
    "0.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255",
    "192.168.1.1", "255.255.255.255", "::", "::1", "[::1]", "fc00::1", "fd12::1", "fe80::1",
    "::ffff:127.0.0.1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1", "not-an-ip", "",
  ]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "172.32.0.1", "2606:4700::1111", "::ffff:93.184.216.34"]) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test("guardUrl : protocole, identifiants, hôtes internes", () => {
  assert.deepEqual(guardUrl(new URL("https://example.com/")), { ok: true });
  assert.deepEqual(guardUrl(new URL("ftp://example.com/")), { ok: false, code: "not_http" });
  assert.deepEqual(guardUrl(new URL("https://a:b@example.com/")), { ok: false, code: "userinfo" });
  for (const url of [
    "http://localhost/", "http://LOCALHOST./", "http://metadata.google.internal/", "http://metadata.google.com/",
    "http://printer.local/", "http://app.localhost/", "http://db.internal/", "http://127.0.0.1/", "http://[::1]/",
  ]) {
    assert.deepEqual(guardUrl(new URL(url)), { ok: false, code: "ssrf" }, url);
  }
});
