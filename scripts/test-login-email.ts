import assert from "node:assert/strict";
import { chmod, mkdir } from "node:fs/promises";
import path from "node:path";
import { emailsMatch, normalizeLoginEmail } from "../src/lib/login-email";
import { grantRole } from "../src/lib/platform-store";

async function main() {
  assert.equal(normalizeLoginEmail("  JunoResidência@gmail.com  "), "junoresidencia@gmail.com");
  assert.equal(normalizeLoginEmail("juno.residencia@gmail.com"), "junoresidencia@gmail.com");
  assert.ok(emailsMatch("junoresidência@gmail.com", "junoresidencia@gmail.com"));
  assert.ok(emailsMatch("juno.residencia@Gmail.com", "junoresidencia@gmail.com"));
  assert.equal(emailsMatch("outro@meurim.com", "junoresidencia@gmail.com"), false);

  const dataDir = path.join(process.cwd(), "data");
  await mkdir(dataDir, { recursive: true });
  const prev = (await import("node:fs")).statSync(dataDir).mode;
  await chmod(dataDir, 0o555);
  try {
    const row = await grantRole("doctor", "00000000-0000-0000-0000-000000000001", "SUPER_ADMIN", "test");
    assert.ok(row.id);
  } finally {
    await chmod(dataDir, prev);
  }

  console.log("login-email ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
