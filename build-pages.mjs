import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

const api = "https://primeiro-passo-manaus.akilesian424.chatgpt.site/api/vagas";
const directory = "dist-pages";
await mkdir(directory, { recursive: true });
await cp("web", directory, { recursive: true });
const page = await readFile("web/index.html", "utf8");
await writeFile(directory + "/index.html", page.replace(
  '<meta name="vagas-api" content="/api/vagas">',
  '<meta name="vagas-api" content="' + api + '">',
));
await writeFile(directory + "/.nojekyll", "");
