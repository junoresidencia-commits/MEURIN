import { collectIntegrityCounts } from "../src/lib/platform-integrity";

async function main() {
  const counts = await collectIntegrityCounts();
  console.log(JSON.stringify({ at: new Date().toISOString(), counts }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
