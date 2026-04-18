#!/usr/bin/env node
/**
 * MSAT · shared/worker/build.js
 * -------------------------------------------------------------------
 * Cloudflare Worker를 수동 배포 (대시보드 붙여넣기)할 때 사용하는
 * 간단한 번들러.
 *
 * 사용법:
 *   cd shared/worker
 *   node build.js
 *
 *   → dist/worker.bundled.js 생성
 *     이 파일 내용을 Cloudflare 대시보드 Workers 편집기에 붙여넣으면 됨.
 *
 * 동작:
 *   - worker.js를 엔트리로 읽음
 *   - `import { X } from "./prompts/..."` 구문을 찾아서 해당 파일의 export를
 *     인라인으로 삽입 (단순 정규식 기반, 동일 프로젝트의 ES Module만 처리)
 *   - 외부 모듈(fetch 등)은 건드리지 않음
 *
 * wrangler를 쓸 수 있는 환경이라면 이 스크립트는 불필요하며
 * 그냥 `wrangler deploy`를 쓰면 된다.
 * -------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

const WORKER_DIR = __dirname;
const ENTRY = path.join(WORKER_DIR, "worker.js");
const OUT_DIR = path.join(WORKER_DIR, "dist");
const OUT_FILE = path.join(OUT_DIR, "worker.bundled.js");

function readFile(p) {
  return fs.readFileSync(p, "utf8");
}

/**
 * `import { foo, bar } from "./path"` 을 찾아서,
 * 해당 파일에서 `export function foo` 혹은 `export const foo`를 추출해 인라인한다.
 *
 * 한계: 동일 이름 충돌/중첩 import/re-export 등 복잡한 케이스는 처리하지 않음.
 * 우리 프로젝트처럼 얕은 구조에서는 충분하다.
 */
function bundle(entryPath) {
  const visited = new Set();
  const modulesInlined = []; // 순서 보장

  function processFile(filePath) {
    if (visited.has(filePath)) return "";
    visited.add(filePath);

    let src = readFile(filePath);
    const dir = path.dirname(filePath);

    // 모든 relative import 찾기
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*["'](\.[^"']+)["']\s*;?/g;
    const collected = [];
    let m;
    while ((m = importRegex.exec(src)) !== null) {
      const names = m[1].split(",").map(s => s.trim()).filter(Boolean);
      const relPath = m[2];
      const resolved = path.resolve(dir, relPath);
      const actualPath = fs.existsSync(resolved) ? resolved
                       : fs.existsSync(resolved + ".js") ? resolved + ".js"
                       : null;
      if (!actualPath) {
        throw new Error(`Cannot resolve import "${relPath}" from ${filePath}`);
      }
      collected.push({ matchStart: m.index, matchLen: m[0].length, names, actualPath });
    }

    // import 구문 제거하되 위치는 기록
    // 역순으로 제거해야 인덱스가 안 밀림
    for (let i = collected.length - 1; i >= 0; i--) {
      const { matchStart, matchLen } = collected[i];
      src = src.slice(0, matchStart) + src.slice(matchStart + matchLen);
    }

    // 의존 모듈 먼저 inline
    for (const c of collected) {
      processFile(c.actualPath);
    }

    // 이 파일의 export 제거 (worker.js의 `export default` 는 유지)
    // 하위 모듈들의 `export function`, `export const`를 `function`/`const`로 바꿈
    const isEntry = filePath === entryPath;
    if (!isEntry) {
      src = src.replace(/^export\s+function\s+/gm, "function ");
      src = src.replace(/^export\s+const\s+/gm, "const ");
      src = src.replace(/^export\s+class\s+/gm, "class ");
      // `export { foo };` 형태 제거
      src = src.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, "");
    }

    modulesInlined.push({ filePath, content: src.trim() });
  }

  processFile(entryPath);

  // entry를 맨 끝에 두고, 의존 모듈들을 먼저 배치
  const entryIdx = modulesInlined.findIndex(m => m.filePath === entryPath);
  const entry = modulesInlined.splice(entryIdx, 1)[0];
  modulesInlined.push(entry);

  // 번들 헤더
  const header = [
    "/**",
    " * MSAT · Cloudflare Worker (bundled)",
    ` * Generated: ${new Date().toISOString()}`,
    " * Source: shared/worker/worker.js (+ imported modules)",
    " * Paste this file into the Cloudflare Workers dashboard editor.",
    " */",
    "",
  ].join("\n");

  const modulesBody = modulesInlined.map(m => {
    const rel = path.relative(WORKER_DIR, m.filePath);
    return `// ==========================================================================\n// FILE: ${rel}\n// ==========================================================================\n${m.content}`;
  }).join("\n\n");

  return header + modulesBody + "\n";
}

// Run
try {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const bundled = bundle(ENTRY);
  fs.writeFileSync(OUT_FILE, bundled, "utf8");
  const bytes = fs.statSync(OUT_FILE).size;
  console.log(`✓ Bundled ${(bytes / 1024).toFixed(1)} KB → ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`  Copy this file's contents into the Cloudflare dashboard Workers editor.`);
} catch (e) {
  console.error("✗ Bundle failed:", e.message);
  process.exit(1);
}
