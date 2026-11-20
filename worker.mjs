const sources = {
  gupy: {
    name: "Gupy",
    url: "https://portal.gupy.io/job-search/term%3DJovem%20aprendiz%26state%3DAmazonas%26city%5B%5D%3DManaus",
    parse: parseGupy,
  },
  sine: {
    name: "Sine Manaus",
    url: "https://www.manaus.am.gov.br/wp-json/wp/v2/posts?search=Sine%20Manaus&per_page=8&_fields=id,date,title,link,content",
    parse: parseSine,
  },
};

const htmlEntities = { amp: "&", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", shy: "", hellip: "…" };
function plain(value = "") {
  return String(value).replace(/<[^>]*>/g, " ").replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, key) => {
    if (key[0] !== "#") return htmlEntities[key] ?? entity;
    const code = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  }).replace(/\s+/g, " ").trim();
}

function ageRange(text) {
  const range = text.match(/\b(?:entre\s+|de\s+|\bidade\s*[:–-]?\s*(?:m[ií]nimo\s+)?)?(1[4-9]|2[0-3])\s*(?:anos\s*)?(?:a|e|at[eé]|[-–])\s*(1[4-9]|2[0-4])\s*anos\b/i);
  if (!range || Number(range[1]) > Number(range[2])) return null;
  return [Number(range[1]), Number(range[2])];
}

function gupyLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".gupy.io") ? url.href : null;
  } catch {
    return null;
  }
}

function parseGupy(html) {
  const payload = html.match(/<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  const rows = payload && JSON.parse(payload[1]).props?.pageProps?.initialJobList?.data;
  if (!Array.isArray(rows)) throw new Error("Formato do portal Gupy não reconhecido");
  return rows.flatMap((row) => {
    const url = gupyLink(row.jobUrl);
    const title = plain(row.name);
    if (!url || !row.id || row.city?.toLowerCase() !== "manaus" ||
      (row.type !== "vacancy_type_apprentice" && !/\bjovem aprendiz\b/i.test(title))) return [];
    return [{
      id: "gupy-" + row.id, source: "gupy", title, organization: plain(row.careerPageName), url,
      published: row.publishedDate?.slice(0, 10),
      deadline: row.applicationDeadline?.slice(0, 10),
      type: /banco de talentos/i.test(title) || row.type === "vacancy_type_talent_pool" ? "Banco de talentos" : "Aprendizagem",
      age: ageRange(plain(row.description)), count: null,
    }];
  });
}

function parseSine(json) {
  const posts = JSON.parse(json);
  if (!Array.isArray(posts)) throw new Error("Formato do Sine Manaus não reconhecido");
  return posts.flatMap((post) => {
    if (!post.link?.startsWith("https://www.manaus.am.gov.br/") || !/Sine Manaus/i.test(plain(post.title?.rendered))) return [];
    const paragraphs = [...String(post.content?.rendered ?? "").matchAll(/<(p|h[2-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => plain(match[2]));
    const headings = paragraphs.map((p) => p.match(/^(\d+)\s+vagas?\s*[-–—]\s*(.+)$/i));
    return headings.flatMap((match, index) => {
      if (!match) return [];
      const title = match[2];
      const next = headings.findIndex((entry, position) => position > index && entry);
      const details = paragraphs.slice(index + 1, next < 0 ? undefined : next).join(" ");
      const age = ageRange(details);
      const apprentice = /\baprendiz\b/i.test(title);
      if (!apprentice && (!age || age[0] < 16 || age[0] > 17)) return [];
      const due = details.match(/(?:dispon[ií]vel|inscri[cç][õo]es)\s+at[eé]\s+(\d{2})\/(\d{2})\/(\d{4})/i);
      if (!due) return [];
      return [{
        id: "sine-" + post.id + "-" + index, source: "sine", title, organization: "Sine Manaus",
        url: post.link, published: post.date?.slice(0, 10), deadline: due[3] + "-" + due[2] + "-" + due[1],
        type: apprentice ? "Aprendizagem" : "Primeiro emprego", age, count: Number(match[1]),
      }];
    });
  });
}

function dateInManaus(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function activeJobs(rows) {
  const today = dateInManaus();
  const jobs = rows.flatMap((row) => JSON.parse(row.jobs))
    .filter((job) => job.deadline ? job.deadline >= today
      : job.published && Date.parse(today) - Date.parse(job.published) <= 30 * 86400000)
    .sort((a, b) => String(b.published ?? "").localeCompare(String(a.published ?? "")));
  const seen = new Set();
  return jobs.filter((job) => {
    const key = [job.source, job.organization, job.title, job.type].join("|").toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function catalog(db) {
  const { results } = await db.prepare("SELECT source, checked_at, error_at, jobs FROM source_snapshots").all();
  return {
    jobs: activeJobs(results),
    sources: Object.entries(sources).map(([id, { name }]) => {
      const row = results.find((item) => item.source === id);
      return { id, name, checkedAt: row?.checked_at || null, problem: Boolean(row?.error_at) };
    }),
  };
}

async function refresh(db, current) {
  const now = new Date();
  const today = dateInManaus(now);
  const stale = current.sources.filter(({ checkedAt, problem }) =>
    problem || !checkedAt || dateInManaus(new Date(checkedAt)) !== today);
  if (!stale.length) return current;

  // The public feed refreshes only from configured sources and claims a global cooldown.
  const claim = await db.prepare(`INSERT INTO refresh_gate VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET next_attempt=excluded.next_attempt
    WHERE refresh_gate.next_attempt <= ?`)
    .bind(now.getTime() + 10 * 60000, now.getTime()).run();
  if (!claim.meta.changes) return catalog(db);

  const start = now.toISOString();
  await Promise.all(stale.map(async ({ id }) => {
    const source = sources[id];
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(16000) });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const jobs = source.parse(await response.text());
      await db.prepare(`INSERT INTO source_snapshots VALUES (?, ?, NULL, ?)
        ON CONFLICT(source) DO UPDATE SET checked_at=excluded.checked_at, error_at=NULL, jobs=excluded.jobs
        WHERE excluded.checked_at >= source_snapshots.checked_at`)
        .bind(id, start, JSON.stringify(jobs)).run();
    } catch (error) {
      console.warn(source.name, error.message);
      await db.prepare(`INSERT INTO source_snapshots VALUES (?, '', ?, '[]')
        ON CONFLICT(source) DO UPDATE SET error_at=excluded.error_at
        WHERE excluded.error_at >= source_snapshots.checked_at`).bind(id, start).run();
    }
  }));
  return catalog(db);
}

export { ageRange, parseGupy, parseSine, activeJobs };

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === "/api/atualizar" && request.method === "POST") {
        return Response.redirect(new URL("/api/vagas", request.url), 303);
      }
      if (path === "/api/vagas" && request.method === "GET") {
        const data = await refresh(env.DB, await catalog(env.DB));
        return Response.json(data, {
          headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
        });
      }
      const asset = assets[path];
      if (asset && (request.method === "GET" || request.method === "HEAD")) {
        const body = asset.binary ? Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0)) : asset.body;
        return new Response(request.method === "HEAD" ? null : body, {
          headers: { "Content-Type": asset.type, "X-Content-Type-Options": "nosniff" },
        });
      }
      return new Response("Página não encontrada", { status: 404 });
    } catch (error) {
      console.error(error.message);
      return Response.json({ error: "O catálogo está temporariamente indisponível." }, { status: 503 });
    }
  },
};
