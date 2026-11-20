const $ = (selector) => document.querySelector(selector);
const filters = $("#filters");
const age = $("#age");
const source = $("#source");
const query = $("#query");
const tabs = [...document.querySelectorAll("[data-type]")];
const consultationTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Manaus",
});
let data;
let error = false;

for (let years = 14; years <= 23; years++) {
  age.add(new Option(years + " anos", years));
}

const normalize = (value) => String(value ?? "").normalize("NFD")
  .replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

function displayDate(value) {
  const [year, month, day] = value.split("-");
  return day + "/" + month + "/" + year;
}

function jobCard(job) {
  const card = $("#job-template").content.cloneNode(true);
  const put = (selector, text) => { card.querySelector(selector).textContent = text; };
  put(".badge", job.type);
  put(".job-source", data.sources.find((item) => item.id === job.source)?.name);
  put("h3", job.title === job.title.toUpperCase() ? job.title.toLocaleLowerCase("pt-BR").replace(/^./u, (char) => char.toUpperCase()) : job.title);
  put(".company", job.organization + (job.count ? " · " + job.count + (job.count === 1 ? " vaga" : " vagas") : ""));
  put(".job-age", !job.age ? "Idade não informada" : job.age[0] + " a " + job.age[1] + " anos");
  put(".deadline", job.deadline ? "Até " + displayDate(job.deadline) : "Prazo a confirmar");
  if (job.published) put(".date", displayDate(job.published));
  const link = card.querySelector("a");
  link.href = job.url;
  link.setAttribute("aria-label", "Ver anúncio original de " + job.title + " em " + job.organization);
  return card;
}

function render() {
  const term = normalize(query.value);
  const words = term ? term.split(/\s+/) : [];
  const type = tabs.find((button) => button.getAttribute("aria-pressed") === "true").dataset.type;
  const years = Number(age.value);
  const filtered = Boolean(term || years || type || source.value);
  const jobs = (data?.jobs ?? []).filter((job) => {
    const searchable = normalize(job.title + " " + job.organization);
    return (!type || job.type === type) &&
      (!source.value || job.source === source.value) &&
      (!years || (job.age && years >= job.age[0] && years <= job.age[1])) &&
      words.every((word) => searchable.includes(word));
  });

  $("#jobs").replaceChildren(...jobs.map(jobCard));
  $("#age-note").hidden = !years;
  const pending = !data && !error;
  $("#total").textContent = pending ? "Buscando vagas…" : error ? "Consulta indisponível"
    : jobs.length + (jobs.length === 1 ? " oportunidade" : " oportunidades");
  $("#empty").hidden = pending || jobs.length > 0;
  $("#reset").hidden = !filtered || error;
  $("#retry").hidden = !error;
  $("#empty-title").textContent = error ? "O catálogo está indisponível"
    : filtered ? "Nenhuma vaga para estes filtros" : "Nenhuma oportunidade disponível no catálogo";
  $("#empty-description").textContent = error ? "Tente novamente ou consulte os canais de vagas abaixo."
    : filtered ? "Altere os filtros para ampliar a busca."
    : "Consulte os canais abaixo enquanto aguarda novas publicações.";
}

function setTab(selected) {
  tabs.forEach((button) => button.setAttribute("aria-pressed", String(button === selected)));
  render();
}

filters.addEventListener("submit", (event) => event.preventDefault());
filters.addEventListener("input", render);
tabs.forEach((button) => button.addEventListener("click", () => setTab(button)));
$("#reset").addEventListener("click", () => {
  filters.reset();
  setTab(tabs[0]);
  query.focus();
});

async function load() {
  data = undefined;
  error = false;
  $("#warning").hidden = true;
  $("#updated").textContent = "";
  render();
  try {
    const response = await fetch($('meta[name="vagas-api"]').content);
    if (!response.ok) throw new Error("Catálogo indisponível");
    data = await response.json();
    $("#updated").textContent = data.sources.map(({ name, checkedAt }) => {
      const time = checkedAt ? consultationTime.format(new Date(checkedAt)) : "aguardando consulta";
      return name + " · " + time;
    }).join(" | ");
    const failed = data.sources.filter((item) => item.problem).map((item) => item.name);
    if (failed.length) {
      const warning = $("#warning");
      warning.hidden = false;
      warning.textContent = "Falha na última consulta: " + failed.join(", ") + ". Confira a disponibilidade no anúncio.";
      error = !data.sources.some((item) => item.checkedAt);
    }
  } catch {
    error = true;
  }
  render();
}

$("#retry").addEventListener("click", load);
load();
