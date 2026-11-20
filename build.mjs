import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const assets = {};
for (const [path, type] of Object.entries({
  "/": "text/html; charset=utf-8",
  "/styles.css": "text/css; charset=utf-8",
  "/app.js": "text/javascript; charset=utf-8",
  "/hero.webp": "image/webp",
})) {
  try {
    const body = await readFile(path === "/" ? "web/index.html" : "web" + path);
    assets[path] = { type, body: body.toString(path === "/hero.webp" ? "base64" : "utf8") };
  } catch (error) {
    if (path !== "/hero.webp" || error.code !== "ENOENT") throw error;
  }
}

const server = await readFile("worker.mjs", "utf8");
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await writeFile("dist/server/index.js", "const assets = " + JSON.stringify(assets) + ";\n" + server);
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
