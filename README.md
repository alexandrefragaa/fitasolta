# FitaSolta — mural de fontes e investigações

O FitaSolta é uma ferramenta independente para organizar fontes públicas, relações documentadas, afirmações, casos e andamento editorial. O sistema guarda metadados, citações, localizadores e links de origem; não hospeda cópias de vídeos nem uploads de PDFs.

## Requisitos

- Node.js 22.x
- Banco Turso/libSQL com permissão de leitura e escrita
- Git e VS Code para desenvolvimento local

## Configuração local

1. Instale as dependências:

   ```bash
   npm ci
   ```

2. Copie `.env.example` para `.env`.
3. Crie um banco Turso de desenvolvimento e um token read/write. Configure `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. Os nomes antigos `HOST_TURSO` e `TOKEN_TURSO` são aceitos como alternativa, desde que formem um par do mesmo banco.
4. Gere um segredo de sessão:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Cole o resultado em `SESSION_SECRET`.

5. Gere um hash bcrypt para uma senha administrativa forte:

   ```bash
   node -e "const b=require('bcryptjs'); const p=process.argv[1]; if(!p){console.error('Informe uma senha entre aspas como argumento.');process.exit(1)} console.log(b.hashSync(p,12))" "SUA_SENHA_FORTE_AQUI"
   ```

   Execute o comando localmente com sua própria senha e coloque somente o hash em `ADMIN_PASSWORD_HASH`. Nunca compartilhe a senha real nem publique `.env`.

6. Inicie e abra a aplicação:

   ```bash
   npm run dev
   ```

   Acesse http://localhost:3333.

Se o banco não estiver configurado/conectado, a API responde com erro de disponibilidade e não grava em SQLite local como fallback. Isso evita a falsa impressão de que os dados estão persistidos.

## Funcionalidades

### Mural e fontes

A página inicial oferece o mural de entidades e relações documentadas e links de fontes. Uma conexão temática não comprova culpa, causalidade, conluio ou participação criminosa. A fonte, o contexto e o estado de verificação precisam acompanhar cada registro.

### Debates e checagens

A página `/debates.html` organiza os materiais originais enviados para análise, fichas de afirmação, URLs de checagens jornalísticas e fontes primárias.

1. Entre na **Área administrativa** da página inicial com a conta administrativa configurada e acesse a página de debates na mesma sessão.
2. Registre a fala literal, quem a proferiu, o material original, o timestamp para vídeos e o contexto. Publicações do X podem não ter timestamp.
3. Cadastre checagens existentes, fontes primárias e evidências favoráveis/contrárias.
4. Salve a ficha como rascunho. Rascunhos ficam privados; a sequência editorial é enviar para revisão, aprovar e publicar separadamente.
5. A publicação exige fontes registradas e aprovação explícita. Uma ficha publicada não é alterada silenciosamente: registre correção ou reabra a revisão conforme o fluxo editorial.

O sistema não transcreve automaticamente vídeos, não navega para verificar toda fonte por conta própria e não usa IA para publicar um veredito. Um link ou uma resposta de IA não é prova factual suficiente.

### Investigações estruturadas

A página `/investigations.html` acrescenta abas de **Casos**, **Pessoas**, **Contradições** e **Cortes de vídeo**, mais uma área editorial autenticada para:

- Criar/editar rascunhos de casos com resumo neutro, jurisdição, órgão, referência oficial, status operacional, data de abertura, última conferência e próxima revisão.
- Cadastrar pessoas, organizações e instituições, sem misturar o tipo da entidade ao papel que desempenha em um caso.
- Registrar vínculo entre pessoa e caso (por exemplo, testemunha, vítima, investigado ou autoridade) com fonte e intervalo de validade.
- Registrar andamentos, distinguindo data do fato, data do documento e data da publicação.
- Comparar checagens por uma relação explícita de contradição, sustento ou contextualização.
- Marcar cortes pelo link original, início/fim, citação e contexto anterior/posterior. O sistema não cria, baixa nem hospeda um arquivo de vídeo recortado.

Todos estes registros seguem o fluxo editorial: **rascunho → revisão → aprovação → publicação**. A API pública não devolve rascunhos. Relações pessoa/caso, andamentos e cortes só ficam públicos depois de aprovados e publicados, respeitando também o estado de publicação dos registros associados. Os registros de pessoas devem se limitar a informação necessária e baseada em fonte, com cuidado reforçado para vítimas, testemunhas e pessoas privadas.

## API principal

- `GET /api/health`: indica se o banco está conectado; `503 database=not_configured` significa que faltam variáveis ou a base ainda não está pronta.
- `GET /api/entities`, `GET /api/relationships`, `GET /api/sources`: dados publicados do mural/fontes.
- `GET /api/claims`, `GET /api/claims/:id`: apenas checagens publicadas.
- `GET /api/cases`, `GET /api/cases/:id`: apenas casos publicados e seus vínculos/eventos/checagens/cortes publicados.
- `GET /api/contradictions`, `GET /api/clips`: relações e cortes revisados e publicados.
- Rotas `/api/admin/*`: criação, edição e revisão; exigem sessão administrativa e proteção CSRF nas operações de escrita.

## Testes e CI

Execute:

```bash
npm ci
npm test
node --check src/server.js
node --check public/js/app.js
node --check public/js/debates.js
node --check public/js/investigations.js
```

O teste de integração usa um banco libSQL temporário local e reinicia o servidor para comprovar persistência sem acessar a base real. Ele não substitui o teste de conexão ao banco remoto de Preview/Production.

GitHub Actions executa instalação limpa, checagem de sintaxe e testes a cada push e pull request.

## Configuração na Vercel

Configure `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET`, `ADMIN_PASSWORD_HASH` e `TRUST_PROXY=1` nas variáveis apropriadas de cada ambiente. Para Preview, use **uma base Turso de teste separada e seu próprio token**; nunca copie credenciais da base de produção para um ambiente de teste.

Após alterar variáveis, faça um novo deploy. Antes de promover para produção, confirme o check de build e acesse `/api/health`, que deve responder HTTP 200 com `database=connected`. Em seguida, testar login e gravar/consultar uma ficha no banco remoto de Preview. O teste local com libSQL e CI verde, isoladamente, não comprovam que as variáveis remotas estejam configuradas.

## Segurança e limites conhecidos

- Usa sessões administrativas, CSRF, limite de tentativas de login e auditoria sem IP em texto aberto.
- O banco remoto é o armazenamento persistente; não use arquivos em `/tmp` como banco de produção em execução serverless.
- Não registra senhas ou tokens nos logs.
- Antes de uso público sensível, configure backups e teste de restauração, revise privacidade/LGPD, autorização por função e segurança de SSRF.
- Não presume culpa a partir de uma investigação, denúncia, prisão, conexão entre entidades ou fala fora de contexto.
- Os materiais políticos fornecidos são fontes de origem para checagem, não vereditos prontos. Alegações sem citação literal, timestamp/contexto e fontes confiáveis devem permanecer não verificadas.
