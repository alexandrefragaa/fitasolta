# Tribunal das Conexões — base inicial

Esta é uma **base de desenvolvimento**, não uma aplicação pronta para produção nem uma auditoria jurídica das informações.

## Requisitos

- Node.js 20 ou superior
- VS Code

## Instalação no Windows / VS Code

1. Extraia a pasta do ZIP.
2. Abra a pasta no VS Code.
3. Abra Terminal → Novo Terminal.
4. Execute:

```bash
npm install
```

5. Copie `.env.example` para `.env`.
6. Gere um segredo de sessão:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copie o resultado para `SESSION_SECRET` no `.env`.

7. Gere um hash bcrypt para a senha administrativa:

```bash
node -e "const b=require('bcryptjs'); const p=process.argv[1]; if(!p){console.error('Informe uma senha entre aspas como argumento.');process.exit(1)} console.log(b.hashSync(p,12))" "SUA_SENHA_FORTE_AQUI"
```

Substitua `SUA_SENHA_FORTE_AQUI` por uma senha forte, execute localmente e coloque **somente o hash retornado** em `ADMIN_PASSWORD_HASH`. Não compartilhe sua senha real nem publique `.env`.

8. Inicie:

```bash
npm run dev
```

9. Abra `http://localhost:3000`.

## O que esta base já faz

- Separa HTML, CSS, JavaScript e backend.
- Usa Helmet para cabeçalhos de segurança e CSP.
- Usa cookie de sessão `HttpOnly`, `SameSite=Strict` e `Secure` em produção.
- Protege login com limite de tentativas.
- Verifica token CSRF nas operações de autenticação e upload.
- Registra eventos de auditoria no banco SQLite do servidor.
- Protege o endpoint de auditoria com autenticação no servidor.
- Recebe PDFs em diretório privado e valida tipo/tamanho básicos.
- Não carrega scripts de analytics de terceiros.

## O que ainda NÃO faz

- Não tem OCR nem extração real de texto dos PDFs.
- Não tem IA, pesquisa na web, monitoramento automático ou grafo com relações verificadas.
- Não implementa 2FA.
- Não substitui avaliação de segurança, política de privacidade ou revisão jurídica.
- O SQLite é apropriado para desenvolvimento/pequeno protótipo; produção pode exigir PostgreSQL, armazenamento de objetos privado e serviço de processamento isolado.
- O diretório de uploads é privado por não ser servido como conteúdo estático; ainda é necessário adicionar antivírus/antimalware, inspeção real do conteúdo e regras de retenção antes de aceitar documentos de terceiros.

## HTTPS / SSL

Em `localhost`, use HTTP local para desenvolvimento. Em produção, publique atrás de um provedor que ofereça HTTPS válido (por exemplo, Let's Encrypt ou HTTPS gerenciado pela hospedagem). Configure `NODE_ENV=production` e `SESSION_SECRET` forte. Se usar proxy reverso, revise a configuração `trust proxy` no servidor para corresponder exatamente à infraestrutura. Não habilite `trust proxy` indiscriminadamente.

## Analytics e cookies

A base não usa Google Analytics, pixels publicitários ou cookies de rastreamento. O cookie de sessão é necessário para login. Antes de adicionar analytics, defina finalidade, dados coletados, retenção, base legal e mecanismo de consentimento aplicável; não carregue rastreadores antes do consentimento quando ele for necessário.

## Integração de fontes do Turso

A área administrativa pode consultar a tabela `source_queue` da base Turso. A conexão é somente de leitura; o banco SQLite local do FitaSolta continua separado.

Configure estas variáveis no ambiente do servidor (por exemplo, em Vercel → Settings → Environment Variables):

```env
TURSO_DATABASE_URL=libsql://NOME-DA-BASE-ORGANIZACAO.turso.io
TURSO_AUTH_TOKEN=COLE_AQUI_UM_TOKEN_READ_ONLY
```

Use o hostname real exibido na página de conexão do banco e gere um token **read-only** para essa base. Não coloque o token no código, no GitHub ou no navegador. Depois de adicionar/alterar as variáveis, faça um novo deploy. Sem as variáveis, o restante do FitaSolta continua funcionando normalmente; apenas a lista de fontes do Turso fica indisponível.

A lista é exibida somente após login administrativo, pode ser filtrada e não altera os registros da fila. Verifique a fonte original antes de usar um resumo como evidência.

## Antes de publicar

- Use PostgreSQL/armazenamento de arquivos privados conforme a escala.
- Adicione 2FA, recuperação de conta segura e gestão de usuários.
- Adicione testes automatizados, monitoramento, backups criptografados e restauração testada.
- Configure logs sem senhas, tokens ou conteúdo sensível.
- Adicione verificação de malware, limites de upload e pipeline de PDF/OCR isolado.
- Faça revisão de segurança e LGPD.
- Verifique cada afirmação, relação e conclusão jurídica contra fontes primárias, registrando data, URL, trecho e estado processual.
