import assert from "node:assert/strict";
import { parseStagingUrl, PRODUCTION_HOSTS } from "../src/lib/readiness-url";

assert.equal(parseStagingUrl("https://meurin-stagin.vercel.app").ok, true);
assert.equal((parseStagingUrl("https://meurin-stagin.vercel.app") as { url: string }).url, "https://meurin-stagin.vercel.app");
assert.equal(parseStagingUrl("meurin-stagin.vercel.app").ok, true);
assert.equal(parseStagingUrl("https://meurim.vercel.app").ok, false);
assert.equal(parseStagingUrl("https://meurin.vercel.app").ok, false);
assert.equal(parseStagingUrl("http://localhost:3000").ok, false);
assert.equal(parseStagingUrl("").ok, false);
assert.ok(PRODUCTION_HOSTS.has("meurim.vercel.app"));
console.log("readiness ok");
