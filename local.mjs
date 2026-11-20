import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "./dist/server/index.js";

mkdirSync(".local", { recursive: true });
const sqlite = new DatabaseSync(".local/catalogo.sqlite");
if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name = 'source_snapshots'").get()) {
  sqlite.exec(readFileSync("drizzle/0000_catalogo.sql", "utf8"));
}
sqlite.exec(readFileSync("drizzle/0001_refresh_gate.sql", "utf8"));
const DB = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    return {
      all: () => ({ results: statement.all() }),
      bind: (...values) => ({ run: () => ({ meta: statement.run(...values) }) }),
    };
  },
};

createServer(async (request, response) => {
  const port = process.env.PRIMEIRO_PASSO_PORT || 4173;
  const body = request.method === "POST" ? Buffer.concat(await Array.fromAsync(request)) : undefined;
  const result = await worker.fetch(new Request("http://localhost:" + port + request.url, {
    method: request.method,
    body,
  }), { DB });
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(Buffer.from(await result.arrayBuffer()));
}).listen(process.env.PRIMEIRO_PASSO_PORT || 4173, "127.0.0.1", () => {
  console.log("http://127.0.0.1:" + (process.env.PRIMEIRO_PASSO_PORT || 4173));
});
