# Primeiro Passo Manaus

Portal de vagas de aprendizagem e primeiro emprego em Manaus. A seleção dá preferência a anúncios originais com localização e prazo verificáveis. O filtro de idade usa apenas faixas publicadas, e cada candidatura segue para a fonte.

[Abrir o portal hospedado](https://primeiro-passo-manaus.akilesian424.chatgpt.site). O portal funciona no navegador e o GitHub hospeda o código-fonte.

## Rodar localmente

Use Node.js 24 ou superior. Execute `npm start` e visite `http://127.0.0.1:4173`. A primeira consulta preenche a base SQLite local. Execute `npm test` para verificar os parsers e o filtro de validade.

## Atualizar

O Worker consulta a página pública de busca da Gupy e as publicações da Prefeitura de Manaus. A base D1 persiste o resultado separado por fonte e retém a última leitura bem-sucedida quando há falha. CIEE e Espro aparecem como links de consulta. Um retorno vazio de uma fonte pode ser válido.

A rotina diária e o portal consultam `GET /api/vagas`. A primeira leitura do dia em Manaus atualiza as fontes e devolve o resultado salvo. O banco controla o intervalo entre tentativas para evitar consultas concorrentes. A rota antiga `POST /api/atualizar` redireciona para a consulta.
