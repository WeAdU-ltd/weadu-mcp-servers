import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRobots } from "./robots.ts";

test("11. motif avec joker", () => {
  const body = "User-agent: GPTBot\nDisallow: /secret*\n";
  assert.deepEqual(evaluateRobots(body, "GPTBot", "/secret-page"), { allowed: false, matchedRule: "disallow:/secret*" });
  assert.deepEqual(evaluateRobots(body, "GPTBot", "/public"), { allowed: true, matchedRule: null });
});

test("groupe le plus spécifique, puis * par défaut", () => {
  const body = "User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n";
  assert.equal(evaluateRobots(body, "GPTBot", "/x").allowed, true);
  assert.equal(evaluateRobots(body, "CCBot", "/x").allowed, false);
  assert.deepEqual(evaluateRobots("", "GPTBot", "/"), { allowed: true, matchedRule: null });
  assert.deepEqual(evaluateRobots("User-agent: CCBot\nDisallow: /\n", "GPTBot", "/"), { allowed: true, matchedRule: null });
});

test("motif le plus long gagne, allow gagne à égalité, $ ancre la fin", () => {
  const body = "User-agent: *\nDisallow: /shop\nAllow: /shop/public\nDisallow: /*.pdf$\nAllow: /same\nDisallow: /same\n";
  assert.equal(evaluateRobots(body, "GPTBot", "/shop/cart").allowed, false);
  assert.deepEqual(evaluateRobots(body, "GPTBot", "/shop/public/a"), { allowed: true, matchedRule: "allow:/shop/public" });
  assert.equal(evaluateRobots(body, "GPTBot", "/doc.pdf").allowed, false);
  assert.equal(evaluateRobots(body, "GPTBot", "/doc.pdf?x=1").allowed, true);
  assert.deepEqual(evaluateRobots(body, "GPTBot", "/same"), { allowed: true, matchedRule: "allow:/same" });
});

test("Disallow vide, commentaires, groupes multi-agents et groupes fusionnés", () => {
  assert.equal(evaluateRobots("User-agent: *\nDisallow:\n", "GPTBot", "/a").allowed, true);
  const body = "# top\nUser-agent: GPTBot\nUser-agent: CCBot\nDisallow: /a # comment\nUser-agent: GPTBot\nDisallow: /b\n";
  assert.equal(evaluateRobots(body, "CCBot", "/a").allowed, false);
  assert.equal(evaluateRobots(body, "GPTBot", "/a").allowed, false);
  assert.equal(evaluateRobots(body, "GPTBot", "/b").allowed, false);
  assert.equal(evaluateRobots("User-agent: *\nDisallow: /a.b(c)\n", "GPTBot", "/a.b(c)").allowed, false);
  assert.equal(evaluateRobots("User-agent: *\nDisallow: /a.b\n", "GPTBot", "/axb").allowed, true);
});
