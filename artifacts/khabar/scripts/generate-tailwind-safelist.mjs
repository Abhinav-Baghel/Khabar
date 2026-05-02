import fs from "node:fs";
import path from "node:path";

const projectDir = path.resolve(process.cwd());
const srcDir = path.join(projectDir, "src");
const outPath = path.join(srcDir, "tailwind-safelist.generated.css");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === "out") continue;
      out.push(...walk(full));
      continue;
    }
    out.push(full);
  }
  return out;
}

// Tailwind v4 scans class tokens as plain text.
// We generate a deterministic safelist from token-like substrings in your source.
const TOKEN_RE = /[A-Za-z0-9][A-Za-z0-9:_\-\[\]\/]*(?:\/\d+(?:\.\d+)?)?/g;
const SINGLE_WORDS = new Set(["flex", "grid", "hidden", "block", "inline", "inline-flex", "relative", "absolute", "fixed", "sticky"]);

function isProbablyTailwindToken(token) {
  if (!token || token.length < 2 || token.length > 80) return false;
  if (token.includes("http://") || token.includes("https://")) return false;
  if (token.includes("://")) return false;
  if (!token.includes("-") && !token.includes(":") && !token.includes("[") && !token.includes("/") && !SINGLE_WORDS.has(token)) {
    return false;
  }
  // Common identifiers that frequently appear in JS/TSX but aren't Tailwind tokens.
  if (["div", "span", "button", "input", "select", "option"].includes(token)) return false;
  return true;
}

const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".html"]);
const files = fs.existsSync(srcDir) ? walk(srcDir) : [];

const tokens = new Set();
for (const file of files) {
  const ext = path.extname(file);
  if (!exts.has(ext)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(TOKEN_RE)) {
    const t = m[0];
    if (isProbablyTailwindToken(t)) tokens.add(t);
  }
}

const sorted = Array.from(tokens).sort((a, b) => a.localeCompare(b));

const lines = [
  "/* Generated Tailwind safelist (do not edit by hand). */",
  "/* If you change classNames in code, re-run: pnpm -C artifacts/khabar scripts/generate-tailwind-safelist.mjs */",
];

for (const token of sorted) {
  // Tailwind parses this as inline brace-expanded class candidates.
  lines.push(`@source inline("${token}");`);
}

fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`Wrote safelist: ${outPath}`);
console.log(`Unique candidate tokens: ${sorted.length}`);

