import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("publica a interface e seus recursos com a URL pública da API", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "primeiro-passo-pages-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await cp(new URL("./web", import.meta.url), join(workspace, "web"), { recursive: true });
  const script = fileURLToPath(new URL("./build-pages.mjs", import.meta.url));
  execFileSync(process.execPath, [script], { cwd: workspace });

  const output = join(workspace, "dist-pages");
  const html = await readFile(join(output, "index.html"), "utf8");
  assert.ok(html.includes('name="vagas-api" content="https://primeiro-passo-manaus.akilesian424.chatgpt.site/api/vagas"'));
  for (const asset of ["styles.css", "app.js", "favicon.ico"]) {
    assert.ok(html.includes('"./' + asset + '"'), asset + " deve usar o caminho relativo");
    assert.ok((await readFile(join(output, asset))).length > 0, asset + " deve estar no build");
  }
  assert.ok((await readFile(join(output, "hero.webp"))).length > 0);
  await readFile(join(output, ".nojekyll"));
});
