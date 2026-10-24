# FitaSolta — radar de fontes e conexões

O FitaSolta reúne fontes públicas, acontecimentos, medidas, processos e relações documentadas. Os materiais continuam nos sites originais.

## Automação
O cron diário consulta feeds públicos da Agência Brasil, Agência Senado e Agência Câmara, adiciona novidades ao Turso e tenta processar até três fontes por execução. Enquanto houver uma fila antiga acumulada, importa uma fonte nova por dia para ajudar a reduzir as pendências. Quando o texto está acessível, a IA organiza categoria, data explícita, pessoas, instituições, casos/processos, andamento mencionado, pontos relevantes e limites do texto. As conexões registram menções na fonte e não implicam culpa.

A página pública lê a mesma fila do processamento e atualiza as fontes automaticamente a cada dois minutos. Votação, comparação e revisão manual foram retiradas da navegação.

## Limitações
A descoberta depende dos feeds configurados e da permissão de acesso automatizado. PDFs não legíveis, fontes bloqueadas e conteúdo autenticado podem falhar. O radar não varre toda a internet. A IA não determina sozinha se algo é verdadeiro ou falso nem substitui a leitura do original. Diferencie investigação, denúncia, acusação, decisão provisória, condenação, absolvição, soltura e anulação.

## Configuração e testes
Node.js 22.x, Git e Turso/libSQL. Configure HOST_TURSO/TOKEN_TURSO (ou TURSO_DATABASE_URL/TURSO_AUTH_TOKEN), SESSION_SECRET, ADMIN_PASSWORD_HASH, GEMINI_API_KEY e CRON_SECRET. Nunca coloque senhas/tokens no GitHub. Execute npm test e node --check src/server.js. O cron exige Authorization: Bearer CRON_SECRET. Faça backups regulares do banco.
