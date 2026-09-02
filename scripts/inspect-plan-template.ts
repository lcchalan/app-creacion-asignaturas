import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspectPlanTemplateProfile } from "../src/academic/plan-template-profile.js";

const input = process.argv[2] || "knowledge/official/fpdsm.docx";
const path = resolve(process.cwd(), input);
const bytes = new Uint8Array(await readFile(path));
const profile = await inspectPlanTemplateProfile(bytes);
console.log(JSON.stringify({ file: input, ...profile }, null, 2));
if (profile.profile === "UNKNOWN") process.exitCode = 2;
