/* scripts/find-imports.js
   Usage: node scripts/find-imports.js <module-fragment>
   Example: node scripts/find-imports.js services/api
*/
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/find-imports.js <module-fragment>");
  process.exit(2);
}
const exts = [".js",".jsx",".ts",".tsx",".mjs",".cjs"];
function walk(dir, results=[]) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walk(full, results);
    } else {
      if (!exts.includes(path.extname(name))) continue;
      const text = fs.readFileSync(full, "utf8");
      text.split(/\r?\n/).forEach((line, i) => {
        if (line.includes(target)) results.push({ file: path.relative(root, full), line: i+1, text: line.trim() });
      });
    }
  }
  return results;
}
const matches = walk(root);
if (!matches.length) console.log("No matches for:", target);
else matches.forEach(m => console.log(`${m.file}:${m.line}  →  ${m.text}`));
