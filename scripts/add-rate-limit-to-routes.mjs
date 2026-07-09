#!/usr/bin/env node
/**
 * One-off script: add checkApiRateLimit to API route files that don't have it.
 * - If file has checkAiRateLimit but not checkApiRateLimit: add import and apiRl check before ai rl.
 * - If file has auth()/requireAuth but no rate limit: add import and rl check after auth.
 * Run from project root: node scripts/add-rate-limit-to-routes.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, "..", "app", "api");

function findRouteFiles(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) findRouteFiles(full, list);
    else if (e.name === "route.ts") list.push(full);
  }
  return list;
}

const rateLimitImport = 'import { checkApiRateLimit } from "@/lib/rate-limit-api";';
const rateLimitImportWithIp = 'import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";';

function addImport(content, useGetClientIp = false) {
  if (content.includes("checkApiRateLimit")) return content;
  const imp = useGetClientIp ? rateLimitImportWithIp : rateLimitImport;
  if (content.includes('from "@/lib/rate-limit-api"')) return content;
  if (content.includes('from "@/lib/rate-limit-ai"')) {
    return content.replace(
      /(import \{ checkAiRateLimit \} from "@\/lib\/rate-limit-ai";)/,
      `${rateLimitImport}\n$1`
    );
  }
  if (content.includes("from \"@clerk/nextjs/server\"")) {
    return content.replace(
      /(import \{ auth \} from "@clerk\/nextjs\/server";)/,
      `$1\nimport { checkApiRateLimit } from "@/lib/rate-limit-api";`
    );
  }
  if (content.includes("requireAuth") && content.includes("api-auth")) {
    return content.replace(
      /(import \{ requireAuth \} from "@\/lib\/api-auth";)/,
      `$1\nimport { checkApiRateLimit } from "@/lib/rate-limit-api";`
    );
  }
  const firstImport = content.match(/^import .+ from .+;$/m);
  if (firstImport) {
    return content.replace(/^import .+ from .+;$/m, (m) => m + "\n" + imp);
  }
  return content;
}

function addRateLimitAfterAuth(content) {
  if (content.includes("checkApiRateLimit(")) return content;
  const patterns = [
    [/(\s+)(const \{ userId \} = await auth\(\);)\n(\s+if \(!userId\)[^\n]+\n\s+\}\n)/, "$1$2\n$3$1const rl = await checkApiRateLimit(userId);\n$1if (rl) return rl;\n"],
    [/(\s+)(const \[userId, err\] = await requireAuth\(\);)\n(\s+if \(err\) return err;\n)/, "$1$2\n$3$1const rl = await checkApiRateLimit(userId);\n$1if (rl) return rl;\n"],
    [/(\s+)(const \{ userId \} = await auth\(\);)\n(\s+if \(!userId\) return[^\n]+\n)/, "$1$2\n$3$1const rl = await checkApiRateLimit(userId);\n$1if (rl) return rl;\n"],
  ];
  for (const [re, repl] of patterns) {
    if (re.test(content)) {
      return content.replace(re, repl);
    }
  }
  return content;
}

function addApiRateLimitBeforeAi(content) {
  if (content.includes("checkApiRateLimit(")) return content;
  if (!content.includes("checkAiRateLimit(userId")) return content;
  return content.replace(
    /(\s+)(const rl = checkAiRateLimit\(userId[^)]*\);)/,
    "$1const apiRl = await checkApiRateLimit(userId);\n$1if (apiRl) return apiRl;\n$1$2"
  );
}

const files = findRouteFiles(apiDir);
let changed = 0;
for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  const rel = path.relative(path.join(apiDir, "..", ".."), file);
  if (rel.includes("webhooks")) continue;
  const orig = content;
  content = addImport(content);
  content = addApiRateLimitBeforeAi(content);
  content = addRateLimitAfterAuth(content);
  if (content !== orig) {
    fs.writeFileSync(file, content);
    changed++;
    console.log("Updated:", file);
  }
}
console.log("Done. Changed", changed, "files.");
