# FitaSolta — mural de fontes e conexões

Esta é uma **base de desenvolvimento**, não uma aplicação pronta para produção nem uma auditoria jurídica das informações.

## Requisitos

- Node.js 22.x
- Banco Turso (libSQL)
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
- Verifica token CSRF nas operações administrativas.
- Registra eventos de auditoria e sessões no banco Turso.
- Protege o endpoint de auditoria com autenticação no servidor.
- Não carrega scripts de analytics de terceiros.

## O que ainda NÃO faz

- Não tem IA, pesquisa na web, monitoramento automático ou grafo com relações verificadas.
- Não implementa 2FA.
- Não substitui avaliação de segurança, política de privacidade ou revisão jurídica.
- Usa Turso/libSQL remoto para persistência compatível com execução serverless; o aplicativo não depende de arquivos SQLite graváveis no disco da Vercel.

## HTTPS / SSL

Em `localhost`, use HTTP local para desenvolvimento. Em produção, publique atrás de um provedor que ofereça HTTPS válido (por exemplo, Let's Encrypt ou HTTPS gerenciado pela hospedagem). Configure `NODE_ENV=production` e `SESSION_SECRET` forte. Se usar proxy reverso, revise a configuração `trust proxy` no servidor para corresponder exatamente à infraestrutura. Não habilite `trust proxy` indiscriminadamente.

## Analytics e cookies

A base não usa Google Analytics, pixels publicitários ou cookies de rastreamento. O cookie de sessão é necessário para login. Antes de adicionar analytics, defina finalidade, dados coletados, retenção, base legal e mecanismo de consentimento aplicável; não carregue rastreadores antes do consentimento quando ele for necessário.

## Antes de publicar

- Configure `HOST_TURSO` e `TOKEN_TURSO` no ambiente do servidor.
- Adicione 2FA, recuperação de conta segura e gestão de usuários.
- Adicione testes automatizados, monitoramento, backups criptografados e restauração testada.
- Configure logs sem senhas, tokens ou conteúdo sensível.
- Faça backups do banco e teste a restauração.
- Faça revisão de segurança e LGPD.
- Verifique cada afirmação, relação e conclusão jurídica contra fontes primárias, registrando data, URL, trecho e estado processual.
