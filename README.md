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
3. No painel do Turso, crie um banco e um token com permissão de leitura e escrita. Configure `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. Os nomes legados `HOST_TURSO` e `TOKEN_TURSO` continuam aceitos como alternativa.
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

## Debates, checagens e revisão editorial

A página `/debates.html` organiza materiais originais e uma ficha estruturada por afirmação.

1. Abra a página inicial e entre na **Área administrativa** com a conta configurada pelo responsável pelo projeto. Volte a `/debates.html` na mesma sessão.
2. Escolha o vídeo ou a publicação original, registre a fala literal, o contexto e um timestamp válido para vídeos. Para publicações do X, o timestamp pode ficar vazio.
3. Registre os URLs das checagens jornalísticas e das fontes primárias. Use **Salvar rascunho no banco** para persistir a ficha no Turso; sem sessão administrativa, nada é salvo.
4. O rascunho permanece privado. A fila editorial permite iniciar a revisão, editar/rejeitar ou aprovar a ficha. A aprovação exige ao menos uma fonte registrada; a publicação só é permitida depois da aprovação.
5. Apenas registros com status `published` aparecem na lista pública. Revisão, resumo automático ou existência de um link não garantem que uma alegação esteja correta: confira a fala original, a data, o contexto e a fonte antes de publicar.

### API de checagens

- `GET /api/claims`: lista pública somente de checagens publicadas.
- `GET /api/claims/:id`: detalhes públicos de uma checagem publicada e suas fontes.
- `GET /api/admin/claims`: fila privada; exige sessão administrativa.
- `POST /api/admin/claims` e `PUT /api/admin/claims/:id`: criar/editar rascunhos; exigem autenticação e CSRF.
- `POST /api/admin/claims/:id/reviews`: registrar o início de uma revisão editorial.
- `POST /api/admin/claims/:id/decision`: aprovar, rejeitar ou publicar seguindo as transições permitidas.
- `POST /api/admin/claims/:id/sources` e `POST /api/admin/claims/:id/relations`: registrar fontes e relações entre checagens.

A API não transcreve automaticamente vídeos nem decide a veracidade com IA. A publicação é uma ação editorial humana.

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

Configure `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET` e `ADMIN_PASSWORD_HASH` em **Project Settings → Environment Variables**. Para Preview, use uma base de teste separada e um token próprio; não reutilize credenciais da base de produção num ambiente de teste. Não publique valores no GitHub. Após mudar variáveis de ambiente, faça um novo deploy.
