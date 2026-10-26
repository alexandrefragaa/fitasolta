-- FitaSolta: importar links para a fila de fontes do Turso.
-- Execute este arquivo no SQL console do banco Turso de PRODUÇÃO.
-- Seguro para reexecutar: URLs já existentes na source_queue são ignoradas.
-- Todos os itens entram como pending; títulos/resumos devem ser extraídos e revisados,
-- e nenhuma afirmação é publicada automaticamente.

BEGIN;

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'terra-pt-constituicao-1988', 'https://www.terra.com.br/noticias/por-que-o-pt-votou-contra-a-constituicao-de-1988,9bb784705b7760bdf5e8b201e334ebbavbpmjqc8.html', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www.terra.com.br/noticias/por-que-o-pt-votou-contra-a-constituicao-de-1988,9bb784705b7760bdf5e8b201e334ebbavbpmjqc8.html');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'cnn-heranca-juros-altos-lula', 'https://www.cnnbrasil.com.br/blogs/thais-heredia/economia/macroeconomia/heranca-dos-juros-altos-e-do-proprio-governo-lula/', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www.cnnbrasil.com.br/blogs/thais-heredia/economia/macroeconomia/heranca-dos-juros-altos-e-do-proprio-governo-lula/');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'tcu-metade-obras-paralisadas', 'https://portal.tcu.gov.br/imprensa/noticias/diagnostico-do-tcu-mostra-que-metade-das-obras-contratadas-com-recursos-federais-estao-paralisadas', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://portal.tcu.gov.br/imprensa/noticias/diagnostico-do-tcu-mostra-que-metade-das-obras-contratadas-com-recursos-federais-estao-paralisadas');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'tcu-86-mil-obras-paralisadas', 'https://portal.tcu.gov.br/imprensa/noticias/brasil-tem-86-mil-obras-paralisadas-financiadas-com-recursos-federais', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://portal.tcu.gov.br/imprensa/noticias/brasil-tem-86-mil-obras-paralisadas-financiadas-com-recursos-federais');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'familytalks-plano-flavio-familias', 'https://familytalks.org/publicacoes/noticias/nossa-analise-do-plano-de-governo-se-eleito-o-que-flavio-bolsonaro-promete-fazer-pelas-familias', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://familytalks.org/publicacoes/noticias/nossa-analise-do-plano-de-governo-se-eleito-o-que-flavio-bolsonaro-promete-fazer-pelas-familias');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'brasildefato-nordeste-lula', 'https://www.brasildefato.com.br/2026/09/30/governos-de-lula-transformaram-o-nordeste-e-explicam-vitoria-folgada-na-regiao-afirma-cientista-politico/', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www.brasildefato.com.br/2026/09/30/governos-de-lula-transformaram-o-nordeste-e-explicam-vitoria-folgada-na-regiao-afirma-cientista-politico/');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'forum-checagem-creches-paralisadas', 'https://revistaforum.com.br/blogs/contra-fake/checagem-debate-creches-paralisadas/', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://revistaforum.com.br/blogs/contra-fake/checagem-debate-creches-paralisadas/');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'aosfatos-lula-obras-escolas-usp', 'https://www.aosfatos.org/noticias/lula-obras-paradas-escolas-perfil-social-alunos-usp/', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www.aosfatos.org/noticias/lula-obras-paradas-escolas-perfil-social-alunos-usp/');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'transparencia-obras-creches-escolas', 'https://www.transparencia.org.br/publicacoes/mais-de-2-mil-obras-de-creches-e-escolas-com-recursos-federais-estao-paralisadas/', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www.transparencia.org.br/publicacoes/mais-de-2-mil-obras-de-creches-e-escolas-com-recursos-federais-estao-paralisadas/');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'gazetadopovo-obras-creches', 'https://www.gazetadopovo.com.br/educacao/obras-creches-paradas-criancas/', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www.gazetadopovo.com.br/educacao/obras-creches-paradas-criancas/');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'senado-obras-creches-vagas', 'https://www12.senado.leg.br/noticias/materias/2019/04/11/obras-paralisadas-impediram-criacao-de-1-2-milhao-novas-vagas-em-creches', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www12.senado.leg.br/noticias/materias/2019/04/11/obras-paralisadas-impediram-criacao-de-1-2-milhao-novas-vagas-em-creches');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'cnm-creches-inacabadas-paralisadas', 'https://cnm.org.br/comunicacao/noticias/estudo-da-cnm-mostra-que-ha-476-creches-inacabadas-e-441-paralisadas', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://cnm.org.br/comunicacao/noticias/estudo-da-cnm-mostra-que-ha-476-creches-inacabadas-e-441-paralisadas');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'agenciabrasil-mei-perdao-dividas', 'https://agenciabrasil.ebc.com.br/economia/noticia/2026-10/perdao-de-dividas-e-novo-teto-do-mei-entenda-o-que-muda', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://agenciabrasil.ebc.com.br/economia/noticia/2026-10/perdao-de-dividas-e-novo-teto-do-mei-entenda-o-que-muda');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'g1-mei-perdao-dividas', 'https://g1.globo.com/empreendedorismo/noticia/2026/10/21/lula-perdao-dividas-mei.ghtml', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://g1.globo.com/empreendedorismo/noticia/2026/10/21/lula-perdao-dividas-mei.ghtml');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'veja-mei-teto-perdao-dividas', 'https://veja.abril.com.br/economia/lula-sanciona-lei-que-aumenta-teto-do-mei-e-perdoa-dividas/', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://veja.abril.com.br/economia/lula-sanciona-lei-que-aumenta-teto-do-mei-e-perdoa-dividas/');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'fpabramo-flavio-licenca-maternidade', 'https://fpabramo.org.br/flavio-votou-contra-ampliar-licenca-maternidade-e-propoe-rever-regras-sem-o-congresso/', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://fpabramo.org.br/flavio-votou-contra-ampliar-licenca-maternidade-e-propoe-rever-regras-sem-o-congresso/');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'cfemea-bolsonaro-machista', 'https://cfemea.org.br/pt/cfemea/artigos-e-materias-do-cfemea/11811-bolsonaro-machista.html', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://cfemea.org.br/pt/cfemea/artigos-e-materias-do-cfemea/11811-bolsonaro-machista.html');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'dmt-flavio-projetos-protecao-mulher', 'https://www.dmtemdebate.com.br/licenca-maternidade-turismo-sexual-e-violencia-domestica-tres-vezes-que-flavio-bolsonaro-votou-contra-projetos-de-protecao-a-mulher/', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www.dmtemdebate.com.br/licenca-maternidade-turismo-sexual-e-violencia-domestica-tres-vezes-que-flavio-bolsonaro-votou-contra-projetos-de-protecao-a-mulher/');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'g1-historico-reajustes-salario-minimo', 'https://g1.globo.com/economia/noticia/2019/04/15/veja-historico-dos-ultimos-reajustes-do-salario-minimo.ghtml', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://g1.globo.com/economia/noticia/2019/04/15/veja-historico-dos-ultimos-reajustes-do-salario-minimo.ghtml');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'g1-lula-roberta-luchsinger', 'https://g1.globo.com/politica/noticia/2026/08/28/lula-afirma-nao-conhecer-roberta-luchsinger-redes-sociais-da-empresaria-mostram-registros-dos-dois-juntos.ghtml', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://g1.globo.com/politica/noticia/2026/08/28/lula-afirma-nao-conhecer-roberta-luchsinger-redes-sociais-da-empresaria-mostram-registros-dos-dois-juntos.ghtml');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'g1-empresaria-amiga-lulinha', 'https://g1.globo.com/politica/noticia/2026/10/17/empresaria-amiga-de-lulinha-rebate-declaracao-de-lula-diz-que-nao-e-pilantra-e-que-virou-boi-de-piranha.ghtml', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://g1.globo.com/politica/noticia/2026/10/17/empresaria-amiga-de-lulinha-rebate-declaracao-de-lula-diz-que-nao-e-pilantra-e-que-virou-boi-de-piranha.ghtml');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'folha-saidinhas-veto-lula', 'https://www1.folha.uol.com.br/cotidiano/2024/04/lula-veta-projeto-e-mantem-saidinhas-de-presos-para-visita-a-familiares.shtml', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www1.folha.uol.com.br/cotidiano/2024/04/lula-veta-projeto-e-mantem-saidinhas-de-presos-para-visita-a-familiares.shtml');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'bbc-saidinhas-presos', 'https://www.bbc.com/portuguese/articles/c72p3xn9n8no', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www.bbc.com/portuguese/articles/c72p3xn9n8no');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'agenciabrasil-restricao-saidinha', 'https://agenciabrasil.ebc.com.br/politica/noticia/2024-04/lula-manteve-linhas-basicas-da-restricao-saidinha-diz-lewandowski', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://agenciabrasil.ebc.com.br/politica/noticia/2024-04/lula-manteve-linhas-basicas-da-restricao-saidinha-diz-lewandowski');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'folha-comentarios-saidinhas', 'https://comentarios1.folha.uol.com.br/comentarios/6294524?skin=folhaonline', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://comentarios1.folha.uol.com.br/comentarios/6294524?skin=folhaonline');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'valor-reduflacao-lula', 'https://valor.globo.com/brasil/noticia/2026/04/13/lula-encara-fantasma-de-biden-com-reduflacao-encolhendo-de-barras-de-chocolate-a-cafe-no-brasil.ghtml', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://valor.globo.com/brasil/noticia/2026/04/13/lula-encara-fantasma-de-biden-com-reduflacao-encolhendo-de-barras-de-chocolate-a-cafe-no-brasil.ghtml');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'aosfatos-coca-cola-embalagens-menores', 'https://www.aosfatos.org/noticias/coca-cola-embalagens-menores-lula/', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www.aosfatos.org/noticias/coca-cola-embalagens-menores-lula/');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'bloomberg-inflacao-alimentos-lula', 'https://www.bloomberglinea.com.br/brasil/inflacao-de-alimentos-volta-a-assombrar-consumidor-e-pressiona-lula-antes-das-eleicoes/', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www.bloomberglinea.com.br/brasil/inflacao-de-alimentos-volta-a-assombrar-consumidor-e-pressiona-lula-antes-das-eleicoes/');

INSERT INTO source_queue (id, url, status, title, summary, error_message)
SELECT 'bbc-inflacao-alimentos', 'https://www.bbc.com/portuguese/articles/cv2kdj08deeo', 'pending', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM source_queue WHERE url = 'https://www.bbc.com/portuguese/articles/cv2kdj08deeo');

COMMIT;

-- Conferência após executar:
-- SELECT COUNT(*) AS total_fontes_pendentes
-- FROM source_queue WHERE status = 'pending';
