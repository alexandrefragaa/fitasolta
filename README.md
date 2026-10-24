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

- Mural de entidades e relações.
- URL, data e classificação da evidência para rastrear as fontes.
- Área administrativa protegida por sessão, CSRF e limite de tentativas de login.
- Auditoria de eventos sem registrar o IP em texto aberto.
- Banco remoto Turso/libSQL para persistência em ambiente serverless.
- CSS, JavaScript e HTML servidos a partir de `public/`.

## O que ainda precisa de trabalho

- O projeto não pesquisa a web automaticamente nem confirma as fontes por conta própria.
- O mural não prova uma relação só porque duas entidades estão conectadas; cada afirmação deve ser conferida em fontes confiáveis.
- Antes de um uso sensível ou público amplo, faça revisão de segurança e privacidade, configure backups e teste a restauração.
- Não registre senhas, tokens ou conteúdo privado nos logs.

## Variáveis de ambiente na Vercel

Configure `HOST_TURSO`, `TOKEN_TURSO`, `SESSION_SECRET` e `ADMIN_PASSWORD_HASH` em **Project Settings → Environment Variables**. Não publique os valores no GitHub. Após mudar variáveis de ambiente, faça um novo deploy.


## Fluxo de debates e checagem

- A página `/debates.html` reúne links originais e uma ficha estruturada de checagem.
- Para salvar, entre na área administrativa e depois use **Salvar rascunho no servidor**.
- Rascunhos e URLs das fontes ficam no banco Turso/libSQL; a API pública só lista fichas publicadas.
- Vídeos exigem fala literal, contexto e timestamp; publicações no X podem não ter timestamp.
- A API bloqueia a publicação até que a ficha seja aprovada editorialmente e possua fonte de checagem.
- A inclusão de uma fala ou postagem na página não significa que ela foi verificada.


## Integração de fontes do Turso e revisão com Gemini

A fila de fontes pública e a área administrativa usam a integração separada de fila via `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. O servidor mantém esses valores fora do navegador. O processamento de fontes atualiza status e resumo no banco; portanto, a credencial usada para processar precisa ter permissão de escrita na tabela `source_queue`. Não use token read-only para o botão de processamento.

Configure também `GEMINI_API_KEY` para habilitar revisão assistida e processamento de fontes. O resultado da IA é auxílio editorial: confira sempre o documento original e não publique uma conclusão sem revisão humana.
