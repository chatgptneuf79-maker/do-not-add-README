import fs from "node:fs";
import path from "node:path";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const pkg = readJson("package.json");
const catalog = readJson("src/content/catalog_v1.json");

let prodUrl = "https://neon-pavlova-d87d83.netlify.app";
try {
  const cfg = readJson("scripts/release-config.json");
  if (cfg.prodUrl) prodUrl = cfg.prodUrl;
} catch {}

const stamp = new Date().toISOString().replace(/[:]/g, "-").slice(0, 19);
const outDir = "build_artifacts";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const packet = `# SLP Game — Session Packet

**Build timestamp:** ${stamp}
**App version:** ${pkg.version}
**Catalog version:** ${catalog.version}
**Production URL:** ${prodUrl}
**Teacher PIN:** 2111
**Logging:** since last report
`;

const outPath = path.join(outDir, `SESSION_PACKET_${stamp}.md`);
fs.writeFileSync(outPath, packet, "utf8");
console.log(`Created ${outPath}`);
console.log(`Prod URL: ${prodUrl}`);
