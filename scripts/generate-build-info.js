import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// 从 package.json 读取版本号
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));

// 获取 git commit 前 6 位
let commit = "000000";
try {
  commit = execSync("git rev-parse --short=6 HEAD", { cwd: root }).toString().trim();
} catch {
  console.warn("无法获取 git commit，使用默认值 000000");
}

const content = `// 此文件由 scripts/generate-build-info.js 自动生成，请勿手动编辑
export const VERSION = "${pkg.version}";
export const COMMIT = "${commit}";
`;

const outputPath = resolve(root, "src/build-info.ts");
writeFileSync(outputPath, content, "utf-8");
console.log(`build-info.ts 已生成: VERSION=${pkg.version}, COMMIT=${commit}`);