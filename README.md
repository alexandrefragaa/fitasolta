# FitaSolta — mural de fontes e conexões

O FitaSolta organiza entidades, relações e fontes externas com rastreabilidade. O site guarda metadados e links; não recebe nem hospeda PDFs enviados.

## Requisitos

- Node.js 22.x
- Uma base Turso (libSQL)
- Git e VS Code (para desenvolvimento local)

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env`.
3. No painel do Turso, crie um token com permissão de leitura e escrita. Coloque a URL do banco em `HOST_TURSO` e o token em `TOKEN_TURSO`.
4. Gere um segredo de sessão:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Cole o resultado em `SESSION_SECRET`.

5. Gere um hash bcrypt para uma senha administrativa forte:

   ```bash
   node -e "const b=require('bcryptjs'); const p=process.argv[1]; if(!p){console.error('Informe uma senha entre aspas como argumento.');process.exit(1)} console.log(b.hashSync(p,12))" "SUA_SENHA_FORTE_AQUI"
   ```

   Substitua o texto de exemplo pela sua própria senha, execute localmente e coloque somente o hash retornado em `ADMIN_PASSWORD_HASH`. Não compartilhe a senha real nem publique o arquivo `.env`.

6. Inicie o servidor e abra o endereço local:

   ```bash
   npm run dev
   ```

   Acesse http://localhost:3333.

## Testes

```bash
npm test
node --check src/server.js
```

## O que o projeto oferece

- Mural de pessoas, instituições, casos e relações, com fontes externas rastreáveis.
- Fichas de afirmações persistidas no Turso/libSQL: pessoa, data, material original, timestamp, contexto, tema, tipo e rótulo de evidência.
- Página pública de afirmações publicada somente após aprovação editorial, com links para o original e links diretos ao minuto do vídeo.
- Comparação lado a lado, filtros e linha do tempo por pessoa/data, sem um ranking de candidatos.
- Revisão manual e assistida por IA (Gemini quando `GEMINI_API_KEY` existe; OpenAI como alternativa), com resultado registrado como sugestão e sem publicação automática.
- Fila de revisão editorial com aprovação e publicação em etapas separadas, histórico de alterações e ação para desfazer a última alteração da ficha.
- Envio público de correções; elas ficam pendentes até triagem e só são mostradas quando aceitas.
- Votação participativa mensal de prioridades temáticas com painel que atualiza periodicamente. Não é uma pesquisa eleitoral; a região é opcional e autodeclarada.
- Métricas agregadas opcionais, sem guardar textos pesquisados, endereços IP ou identificadores de visitante nas tabelas de analytics.
- Área administrativa protegida por sessão remota Turso, CSRF e limite de tentativas de login.

## Revisão de fontes preexistentes

A área administrativa também mantém a fila `source_queue` já utilizada pelo projeto: carrega as fontes, permite processar até três fontes pendentes por execução e usa Gemini para extrair título/resumo e apontar limitações. A leitura do texto da URL é um apoio, não um veredito; o conteúdo extraído nunca publica uma afirmação sozinho. A revisão direta de um trecho com Gemini continua disponível em um painel separado.

## Como publicar uma afirmação

1. Na página inicial, entre na área administrativa.
2. Abra **Afirmações** e preencha a fonte original, a fala literal, a data/timestamp e o contexto. Selecione o tema e registre os links primários/jornalísticos, inclusive evidências contrárias.
3. Salve como rascunho. Ele não aparece publicamente.
4. Abra **Revisão editorial** e registre uma revisão humana. A IA pode ajudar a apontar lacunas e divergências; seu retorno não é prova nem decisão final.
5. Aprove a ficha somente após conferir as fontes. A publicação é uma ação separada. Correções posteriores ficam no histórico e podem ser triadas no painel.

## Variáveis de ambiente

Obrigatórias: `SESSION_SECRET` (segredo aleatório com 32+ caracteres), `ADMIN_PASSWORD_HASH` (hash bcrypt) e um par correspondente de banco Turso/libSQL: `HOST_TURSO` + `TOKEN_TURSO` ou `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`. Para o Preview, use um banco de teste separado; não compartilhe o mesmo banco de produção.

Opcionais: `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY` e `OPENAI_MODEL`. As chaves ficam em **Vercel → Project Settings → Environment Variables**, nunca no Git ou no frontend. `GEMINI_API_KEY` habilita a revisão de afirmações pelo Gemini; o servidor usa OpenAI como fallback se só houver `OPENAI_API_KEY`.

## Limites e cuidados ainda necessários

- IA não confirma fontes automaticamente e não substitui revisão humana.
- A votação agrega apenas respostas do site; não é amostra representativa, pesquisa eleitoral, margem de erro ou estimativa da opinião da população.
- Estado/cidade/país da votação são informados voluntariamente e não verificados.
- O painel marca fichas antigas e fichas sem fontes externas, mas ainda não faz verificação automática de todos os links mortos.
- Configure backups no Turso e teste a restauração. Revise a segurança, a privacidade e os requisitos LGPD antes de um uso sensível ou grande escala.
- Não registre senhas, tokens ou conteúdo privado nos logs.

## Variáveis de ambiente na Vercel

Configure `HOST_TURSO`, `TOKEN_TURSO`, `SESSION_SECRET` e `ADMIN_PASSWORD_HASH` em **Project Settings → Environment Variables**. Não publique os valores no GitHub. Após mudar variáveis de ambiente, faça um novo deploy.
