# FitaSolta — radar público de fontes, falas e evidências

O FitaSolta organiza links públicos, acontecimentos, medidas, processos, vídeos e afirmações que possam ser verificadas. A meta é mostrar primeiro o material original e a conclusão compacta; os detalhes e links de evidência ficam recolhidos para manter o site fácil de ler.

## Como funciona o fluxo automático

1. **Descoberta diária:** o cron da Vercel consulta feeds públicos da Agência Brasil, Agência Senado e Agência Câmara.
2. **Processamento:** tenta concluir até três itens por execução. Enquanto existe um acúmulo antigo de pendências, importa apenas uma novidade por dia, para a fila diminuir. Erros e itens presos podem ser tentados novamente em execuções seguintes.
3. **Vídeos e falas:** o sistema identifica vídeos do YouTube e tenta ler legendas públicas com timestamps. Quando não há legenda acessível, pode mostrar o player e manter o conteúdo como não verificado. O painel privado aceita links, imagens acessíveis, transcrição, trechos literais e contexto.
4. **Checagem assistida:** quando a extração encontra uma fala literalmente presente no texto/transcrição, o sistema pode pesquisar evidências com Google Search grounding. O cartão separa fontes que sustentam a afirmação, fontes que contradizem ou limitam e outras fontes encontradas. A pesquisa externa é limitada por lote para controlar uso/custo.
5. **Relações:** nomes de pessoas, instituições, processos e documentos identificados são ligados à fonte. Uma relação registra uma menção; não significa culpa nem comprovação independente.
6. **Atualização da página:** a API pública lê a mesma fila Turso do processamento. O navegador atualiza a lista automaticamente a cada dois minutos, com pesquisa e filtros por tipo/assunto.

## Estados de checagem

O sistema distingue verdadeira, falsa, enganosa, fora de contexto, inconclusiva, não verificada e opinião/proposta/previsão. Rótulos factuais fortes exigem fontes reais vinculadas ao retorno da pesquisa; se não houver evidência suficiente, o rótulo deve permanecer inconclusivo ou não verificado. Uma promessa, previsão, proposta ou opinião não é automaticamente fato verdadeiro/falso.

O critério é o mesmo para qualquer pessoa ou partido, incluindo Lula e Flávio Bolsonaro. Não se presume que toda fala deva ser falsa nem que toda fala deva ser verdadeira. O resumo de IA não substitui a leitura do documento original nem revisão editorial em assuntos de alto impacto.

## Entrada privada de materiais

Na área administrativa autenticada, adicione até 20 links por lote, ou associe um texto/transcrição a um link e/ou mídia. O texto bruto é guardado na fila para análise e **não é devolvido pela API pública**. Para associar uma transcrição colada a um material específico, inclua o link original. A URL pode ser omitida, mas o registro será identificado como texto enviado sem fonte original. Nunca cole senhas, dados pessoais sensíveis ou material que não tenha autorização para compartilhar.

## Limitações

- A descoberta usa os feeds configurados; não é uma busca completa por toda a internet.
- A leitura de vídeos depende de legendas públicas acessíveis. Não se inventam falas, cortes ou timestamps quando elas não existem.
- Imagens e páginas podem não permitir extração automatizada. PDFs, paywalls, sites que bloqueiam robôs e conteúdo com autenticação podem falhar.
- O sistema pode não encontrar um contraponto numa execução. Isso deve ser indicado explicitamente; ausência de fonte contrária na busca não é prova de verdade.
- Investigações, denúncias, acusações, decisões provisórias, condenações, absolvições, recursos e anulações são etapas distintas. Uma notícia não equivale a uma sentença.
- A classificação automática pode errar e deve ser corrigida quando surgirem novas evidências. Não use um rótulo isolado como prova de culpa ou inocência.

## Configuração e testes

Requer Node.js 22.x, Git e Turso/libSQL. Configure `HOST_TURSO`/`TOKEN_TURSO` ou `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`, `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, `GEMINI_API_KEY` e `CRON_SECRET`. Nunca coloque senhas ou tokens no GitHub.

Execute `npm test` e `node --check src/server.js`. O cron exige `Authorization: Bearer CRON_SECRET`. Configure backups regulares do Turso. A agenda está em `vercel.json` e usa o horário do cron da Vercel (12:00 UTC, aproximadamente 09:00 em São Paulo).
