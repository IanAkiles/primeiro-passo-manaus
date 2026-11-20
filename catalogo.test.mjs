import test from "node:test";
import assert from "node:assert/strict";
import { activeJobs, ageRange, parseGupy, parseSine } from "./worker.mjs";

test("extrai apenas oportunidades de aprendizagem em Manaus, com link da fonte", () => {
  const job = { id: 1, name: "Jovem Aprendiz", type: "vacancy_type_apprentice",
    city: "Manaus", jobUrl: "https://empresa.gupy.io/jobs/1", description: "Ter entre 16 e 22 anos." };
  const payload = { props: { pageProps: { initialJobList: { data: [
    job, { ...job, id: 2, city: "Iranduba" }, { ...job, id: 3, jobUrl: "https://gupy.io.exemplo.net/" },
  ] } } } };
  const result = parseGupy('<script id="__NEXT_DATA__">' + JSON.stringify(payload) + "</script>");
  assert.deepEqual(result.map(({ id, age }) => [id, age]), [["gupy-1", [16, 22]]]);
  assert.equal(ageRange("Ensino médio completo."), null);
  assert.throws(() => parseGupy("<html>Falha</html>"));
});

test("remove vagas vencidas, vagas comuns e duplicatas do mesmo anúncio", () => {
  const rows = parseSine(JSON.stringify([{
    id: 1, link: "https://www.manaus.am.gov.br/noticia/", title: { rendered: "Sine Manaus oferta 5 vagas" },
    content: { rendered: "<p><strong>2 vagas – Jovem Aprendiz</strong></p><p>De 16 a 20 anos</p>" +
      "<p>Disponível até 31/12/2099.</p><p>3 vagas – Motorista</p><p>Disponível até 31/12/2099.</p>" },
  }]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].deadline, "2099-12-31");
  const content = [{ jobs: JSON.stringify([...rows, ...rows, { ...rows[0], deadline: "2000-01-01" }]) }];
  assert.equal(activeJobs(content).length, 1);
});
