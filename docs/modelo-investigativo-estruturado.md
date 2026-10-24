# Modelo investigativo estruturado — FitaSolta

## Objetivo
Registrar casos, pessoas, organizações, vítimas, investigados, fontes, alegações, checagens e movimentações sem misturar fato documentado com hipótese ou acusação. Cada registro deve ter origem, data de referência, estado de verificação e histórico de alterações.

## Entidades principais

### Caso
- Identificador estável, título, resumo neutro, categoria (crime, investigação pública, processo, política pública, debate ou outro).
- Jurisdição e órgão responsável, números oficiais de inquérito/processo quando públicos.
- Status operacional: notícia inicial, apuração preliminar, investigação em andamento, denúncia oferecida, recebida, processo em curso, decisão, recurso, arquivado, encerrado ou desconhecido.
- Datas de abertura/atualização, próxima revisão e nota sobre limites da informação.
- Não presumir que “investigado”, “denunciado”, “réu” ou “preso” significa culpado.

### Pessoas e organizações
- Nome público/identificador, tipo, descrição estritamente necessária e fontes.
- Papel no caso separado da identidade: vítima, pessoa desaparecida, comunicante, testemunha, investigado, indiciado, denunciado, acusado/réu, condenado por decisão não definitiva, condenado com trânsito em julgado, autoridade, defensor, órgão investigador ou outro.
- Papel exige fonte, intervalo de validade, status e nota de contexto.
- Vítimas e testemunhas exigem proteção reforçada: não publicar endereço, telefone, documentos, dados de menores, informações íntimas ou dados que possam facilitar assédio/revitimização. Não criar perfil público de pessoa privada sem necessidade e base legítima.

### Alegação / afirmação
- Citação literal, autor atribuído, data, URL original, timestamp ou localização, contexto anterior/posterior e transcrição conferida.
- Tipo: fato verificável, opinião, previsão, promessa, interpretação jurídica ou relato de terceiro.
- Classificação editorial: não verificada, verdadeira, falsa, enganosa/sem contexto, imprecisa, inconclusiva, opinião não verificável, corrigida ou retirada.
- A classificação exige justificativa, fontes favoráveis e contrárias, responsável editorial e data da revisão.
- “Fake” não deve ser um rótulo automático; a página deve explicar qual trecho está errado e por quê.

### Fonte / evidência
- URL canônica, título, autor/órgão, tipo (primária, decisão judicial, dado oficial, reportagem, entrevista, publicação social, documento), data de publicação e consulta.
- Trecho exato, página/timestamp, cópia de referência quando permitido, metodologia, limitações e alegações que sustenta/contradiz.
- Registrar se o link foi acessado, se é fonte primária e se a informação foi confirmada independentemente.
- Não tratar conteúdo de redes sociais, texto extraído ou resposta de IA como instrução confiável ou prova autossuficiente.

### Movimentação / andamento
- Caso, data/hora do evento, data em que foi conhecido, órgão, tipo (instauração, diligência divulgada, relatório, indiciamento, denúncia, decisão, recurso, arquivamento etc.), descrição factual, fonte primária, status de verificação e autor da revisão.
- Linha do tempo imutável: correções são novas versões/eventos, nunca apagamento silencioso de registro publicado.
- Distinguir data do fato, data do documento e data da publicação da notícia.

### Relações
- Origem e destino, tipo (envolvido em, investigado por, vítima de, testemunhou, publicou, citou, sustenta, contradiz, atualiza, parte de, relacionado a), evidência e explicação.
- Uma relação precisa ser documentada e temporalmente contextualizada. Relação não implica culpa, causalidade, conluio ou conhecimento.
- Evitar ligações inferidas apenas por homônimos, fotos, proximidade, parentesco ou menções indiretas.

## Fluxo editorial recomendado
1. **Rascunho** — registro privado, incompleto por padrão.
2. **Triagem** — checar URL, identidade, data, jurisdição e risco à privacidade.
3. **Coleta de evidências** — incluir fontes primárias e contraditórias; registrar trechos e localizadores.
4. **Revisão** — segunda leitura humana em alegações sensíveis, crimes e vítimas.
5. **Aprovado** — editor responsável, justificativa, data e versão.
6. **Publicado** — apenas após aprovação explícita.
7. **Correção/retirada** — manter nota de correção, motivo, data e versões anteriores; retirar dados pessoais quando necessário.

## Controles mínimos de segurança e qualidade
- Banco remoto persistente; migrações versionadas; backups e teste de restauração.
- Autenticação, autorização por função, CSRF, rate limit, auditoria sem IP em texto aberto e validação de entrada.
- Papéis editor, revisor e administrador; quem cria não deve ser o único aprovador de material de alto risco.
- Não publicar rascunhos em endpoints públicos; respostas privadas com `Cache-Control: no-store`.
- Histórico de mudanças, atribuição de autoria e registro de justificativa para veredictos.
- Proteção contra SSRF ao buscar URLs; limites de tamanho e tempo; conteúdo externo tratado como dado não confiável.
- Não usar IA para concluir culpa, identificar vítimas, inferir relações pessoais ou publicar automaticamente.
- Revisão periódica de links quebrados, andamento processual e correções de fatos.

## Modelo relacional proposto
- `cases`: metadados e status geral do caso.
- `entities`: pessoas, organizações, órgãos, locais institucionais e eventos públicos.
- `case_roles`: entidade + caso + papel + período + fonte.
- `claims`: afirmações, citação, contexto, tipo, classificação e estado editorial.
- `sources`: referência, autoria, tipo, datas, URL e metadados.
- `claim_sources`: ligação entre alegação e fonte com trecho, página/timestamp e direção (apoia, contradiz, contextualiza).
- `case_sources`: fontes gerais do caso.
- `relationships`: relações documentadas entre entidades, casos e alegações, com evidência e período.
- `case_events`: linha do tempo de andamento e atualizações oficiais.
- `reviews`: snapshots de revisão, revisor, decisão e justificativa.
- `audit_events`: eventos administrativos e alterações relevantes.
- `record_versions`: histórico de versões/correções para registros publicados.

## Critérios de aceite antes de declarar concluído
- Criar e editar caso, pessoa/organização, alegação, fonte, relação e andamento em formulário autenticado.
- Associar várias fontes a uma alegação e várias alegações a um caso.
- Pesquisa por pessoa, caso, status, órgão, classificação e período.
- Página pública exibe apenas registros publicados e as fontes de cada afirmação.
- Nenhum item sensível é publicado sem revisão; casos arquivados e decisões posteriores atualizam a linha do tempo sem apagar o histórico.
- Testes de autorização, validação, relações inválidas, isolamento de rascunhos, migrações e persistência após novo deploy.
