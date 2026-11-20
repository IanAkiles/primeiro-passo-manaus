import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const assets = {};
const binaryTypes = new Set(["image/webp", "image/x-icon"]);
for (const [path, type] of Object.entries({
  "/": "text/html; charset=utf-8",
  "/styles.css": "text/css; charset=utf-8",
  "/app.js": "text/javascript; charset=utf-8",
  "/hero.webp": "image/webp",
  "/favicon.ico": "image/x-icon",
})) {
  try {
    const body = await readFile(path === "/" ? "web/index.html" : "web" + path);
    const binary = binaryTypes.has(type);
    assets[path] = { type, binary, body: body.toString(binary ? "base64" : "utf8") };
  } catch (error) {
    if (path !== "/hero.webp" || error.code !== "ENOENT") throw error;
  }
}

const server = await readFile("worker.mjs", "utf8");
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await writeFile("dist/server/index.js", "const assets = " + JSON.stringify(assets) + ";\n" + server);
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
