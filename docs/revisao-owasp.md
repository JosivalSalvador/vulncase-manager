# Revisão de segurança do backend (OWASP Top 10:2025)

Última revisão: 22/11/2026. A referência é o **OWASP Top 10:2025**, a edição mais recente da lista para aplicações web na data desta revisão. A tabela liga cada categoria aos controles que o backend do VulnCase tem hoje e ao arquivo onde cada um está. Os nomes e códigos seguem o catálogo do projeto (`backend/src/resources/catalog/catalog.data.ts`).

**Situação:** *Coberto* quer dizer que o controle existe e atende a categoria dentro do escopo do protótipo. *Parcial* quer dizer que existe, mas com uma lacuna conhecida, descrita na própria linha.

| OWASP 2025 | Controles no projeto | Onde | Situação |
|------------|----------------------|------|----------|
| A01:2025 Quebra de Controle de Acesso | login obrigatório; papéis ADMIN, ANALYST e VIEWER nas rotas de escrita; só membro do projeto acessa (404 para quem não é); busca de achado e evidência sempre filtrada pelo projeto da URL; membros só pelo dono ou ADMIN; usuários só pelo ADMIN | `backend/src/middlewares/requireAuth.ts`, `backend/src/middlewares/requireRole.ts`, `backend/src/middlewares/requireProjectAccess.ts`, `backend/src/resources/members/members.service.ts`, `backend/src/resources/users/users.router.ts`, `backend/src/resources/findings/findings.idor.integration.test.ts`, `backend/src/resources/projects/projects.authorization.integration.test.ts` | Coberto |
| A02:2025 Configuração Incorreta de Segurança | cabeçalhos do `helmet`; CORS com uma origem e credenciais; variáveis validadas na partida (segredos com 32+ caracteres, `COOKIE_SECURE` ligado por padrão); `.env` fora do git; imagem de produção sem root e sem dependências de desenvolvimento | `backend/src/app.ts`, `backend/src/utils/getEnv.ts`, `backend/Dockerfile`, `.gitignore` | Parcial: faltam `trust proxy`, permissões da pasta de uploads e MySQL com permissão mínima (etapa de infraestrutura) |
| A03:2025 Falhas na Cadeia de Suprimentos de Software | `package-lock.json` com `npm ci`; `npm audit` (nível alto, só produção) na CI e toda segunda; revisão de dependências nos pull requests; Dependabot semanal; `effect` fixado em versão sem a falha de ReDoS; `gitleaks` | `.github/workflows/security.yml`, `.github/dependabot.yml`, `backend/package.json` | Parcial: Actions e imagens Docker fixadas por tag, não por hash |
| A04:2025 Falhas Criptográficas | senhas com bcrypt (custo 12) e nunca devolvidas pela API; cookies `secure` e `__Host-` em produção; segredos longos exigidos | `backend/src/resources/auth/auth.service.ts`, `backend/src/middlewares/session.ts`, `backend/src/middlewares/csrf.ts`, `backend/src/utils/getEnv.ts` | Parcial: a API não termina TLS (depende do proxy) e MySQL e uploads não são cifrados em repouso |
| A05:2025 Injeção | validação com zod em body, params e query; Prisma parametriza as consultas e o código não usa SQL cru; CSV neutraliza fórmulas e Markdown escapa texto; arquivo de evidência com nome gerado e verificação de caminho | `backend/src/middlewares/validate.ts`, `backend/src/resources/findings/findings.schema.ts`, `backend/src/resources/reports/reports.format.ts`, `backend/src/lib/storage.ts` | Coberto no backend; o XSS depende de o frontend exibir tudo como texto |
| A06:2025 Design Inseguro | modelagem de ameaças (STRIDE); acesso por projeto e papéis desde o modelo de dados; matriz de transições de status; deduplicação de achados; limites de tamanho e de tentativas; regras testadas com banco real | `backend/src/resources/findings/findings.transitions.ts`, `backend/src/resources/findings/findings.duplicates.ts`, `backend/prisma/schema.prisma` | Coberto |
| A07:2025 Falhas de Autenticação | bcrypt; mesma resposta e tempo parecido para e-mail inexistente e senha errada; limite de tentativas; sessão nova a cada login, cookie `httpOnly`, expira em 8 h, logout destrói; senha de 8 a 72 caracteres | `backend/src/resources/auth/auth.service.ts`, `backend/src/resources/auth/auth.controller.ts`, `backend/src/middlewares/rateLimit.ts`, `backend/src/middlewares/session.ts`, `backend/src/resources/auth/auth.schema.ts` | Parcial: sem segundo fator, sem bloqueio por conta e sem checagem de senhas vazadas |
| A08:2025 Falhas na Integridade de Software ou Dados | `npm ci` com lockfile; hooks de lint, tipos e commit convencional; CI com testes; evidência validada pelo conteúdo; a API só lê JSON, sem desserializar objetos arbitrários; status e histórico gravados na mesma transação | `.github/workflows/ci.yml`, `.husky/pre-push`, `commitlint.config.js`, `backend/src/resources/evidence/evidence.detect.ts`, `backend/src/resources/findings/findings.service.ts` | Parcial: mesma lacuna das Actions por tag |
| A09:2025 Falhas de Registro e Alerta de Segurança | log de acesso (`morgan`); erros inesperados no log do servidor; histórico de status com o autor de cada troca | `backend/src/app.ts`, `backend/src/middlewares/errorHandler.ts`, `backend/prisma/schema.prisma` | Parcial: sem trilha de auditoria para as outras ações e sem alertas |
| A10:2025 Tratamento Inadequado de Condições Excepcionais | tratador de erros central: validação, CSRF, upload, JSON inválido, registro apagado e arquivo ausente têm resposta própria e o resto vira 500 genérico; corrida na troca de status vira 409; falha ao apagar arquivo é registrada sem derrubar a requisição | `backend/src/middlewares/errorHandler.ts`, `backend/src/resources/findings/findings.service.ts`, `backend/src/lib/storage.ts` | Parcial: `main.ts` não trata `unhandledRejection` nem `uncaughtException` e não encerra com calma (SIGTERM) |

O **SSRF**, que era categoria própria na edição anterior, foi incorporado ao A01:2025. A API não faz requisições a endereços informados pelo usuário, então não há superfície para esse ataque hoje.

**Fora do escopo:** o OWASP Top 10 para aplicações com LLM (edição 2026) é outra lista. O VulnCase não usa modelo de linguagem: o resumo automático dos achados é feito por template.

## Lacunas e o que fazer com elas

- **Infraestrutura:** `trust proxy`, permissões da pasta de uploads e MySQL com permissão mínima ficam para a etapa de Docker e infraestrutura.
- **Cadeia de suprimentos:** fixar Actions e imagens por hash é uma melhoria barata, mas opcional para este protótipo.
- **Erros fora de requisição:** tratar `unhandledRejection`, `uncaughtException` e SIGTERM em `main.ts` é um ajuste pequeno de backend.
- **Autenticação:** segundo fator, bloqueio por conta e senhas vazadas ficam fora do escopo do protótipo.
- **Frontend:** o adendo desta revisão cobrirá a exibição como texto (XSS) quando o frontend existir.

## Onde o OWASP aparece no produto

O próprio VulnCase usa o catálogo para classificar achados. O campo de categoria OWASP de um achado só aceita códigos que existem no catálogo, e as listas são consultadas por `GET /catalog/owasp` e `GET /catalog/cwe`. O catálogo guarda a edição 2025 e também a de 2021, para quem registra achados de relatórios antigos. Os arquivos são `backend/src/resources/catalog/catalog.data.ts`, `backend/src/resources/catalog/catalog.router.ts` e `backend/src/resources/findings/findings.schema.ts`.


**Enumeração de usuários no cadastro (CWE-204, Observable Response Discrepancy)**

Decisão: manter. `POST /auth/register` responde 409 ("E-mail já cadastrado") quando o e-mail já existe, o que revela quais e-mails têm conta. O OWASP recomenda responder igual nos dois casos e enviar um link de ativação por e-mail. O projeto não tem envio de e-mail e, sem ele, quem já tem conta não saberia por que o cadastro falhou. Risco aceito para o protótipo, com mitigações no código: limite de 10 cadastros por hora por IP, token CSRF obrigatório e login com a mesma resposta 401 (e custo de bcrypt equivalente, via hash falso) para e-mail inexistente e senha errada.

Limitações conhecidas: o limite é por IP e fica em memória, então zera ao reiniciar. Evolução possível: cadastro com confirmação por e-mail e resposta única.