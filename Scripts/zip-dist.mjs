import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

const stamp = new Date().toISOString().replace(/[:]/g, "-").slice(0, 19);
const outDir = "build_artifacts";
if (!existsSync(outDir)) mkdirSync(outDir);

execSync(`zip -r ${outDir}/dist_${stamp}.zip dist`, { stdio: "inherit" });
console.log(`Created ${outDir}/dist_${stamp}.zip`);
