# Segurança

> Estado em 21/11/2026 (commit `932cbcb`). Este documento é um retrato do momento e vai mudar conforme o projeto avançar.

O VulnCase guarda informações sensíveis: vulnerabilidades ainda não corrigidas e as evidências delas. Se um vazamento acontecesse aqui, o estrago seria maior do que num sistema comum. Por isso a segurança entrou no projeto desde o começo, em camadas: se uma falhar, a seguinte ainda protege.

Este documento descreve cada decisão, o motivo dela e onde está no código, ligando com o OWASP Top 10 e com os CWE correspondentes. No final há uma tabela de resumo e a lista do que ainda não está coberto.

## 1. Autenticação e senhas

**O que foi feito**

- As senhas são guardadas só como hash bcrypt, com 12 rounds de custo. A senha em si nunca vai ao banco nem aparece em resposta.
- A senha precisa ter de 8 a 72 caracteres. O limite de 72 existe porque o bcrypt só considera os primeiros 72 bytes, então aceitar mais que isso daria uma falsa sensação de segurança.
- O login responde sempre com a mesma mensagem ("E-mail ou senha inválidos"), exista o usuário ou não.
- Quando o e-mail não existe, o servidor compara a senha contra um hash falso. Assim o tempo de resposta não revela se a conta existe (CWE-208).
- O e-mail é normalizado (sem espaços, em minúsculas) antes de ser validado, para não haver duas contas "diferentes" com o mesmo e-mail.
- Há limite de tentativas: 10 logins com falha a cada 15 minutos e 10 cadastros por hora, por IP. Logins bem-sucedidos não contam. Passou do limite, a resposta é 429 (CWE-307).
- As respostas de autenticação devolvem só id, e-mail, nome e papel do usuário.

**Por quê:** impedir que um vazamento do banco exponha senhas, dificultar força bruta e não dar pistas a quem tenta descobrir contas. Relaciona-se com OWASP A07 (falhas de identificação e autenticação) e A02 (falhas criptográficas).

**Onde:** `backend/src/resources/auth/` e `backend/src/middlewares/rateLimit.ts`.

## 2. Sessão

**O que foi feito**

- A sessão fica no servidor, no Redis. O navegador só recebe um cookie com o identificador.
- O cookie é `httpOnly` (o JavaScript da página não lê), `sameSite=lax` e `secure` quando `COOKIE_SECURE=true`, que é o padrão em produção. A sessão dura 8 horas.
- No login, o identificador da sessão é regenerado, o que impede a fixação de sessão (CWE-384). No logout, a sessão é destruída no Redis e o cookie é apagado.
- A cada requisição autenticada o usuário é recarregado do banco. Se o papel dele mudou ou a conta foi apagada, isso vale imediatamente.
- Não é criada sessão para visitantes que não fizeram login (`saveUninitialized: false`).

**Por quê:** com sessão no servidor dá para encerrar um acesso de verdade, coisa que um token assinado e já emitido não permite sem complicações extras. Relaciona-se com A07.

**Onde:** `backend/src/middlewares/session.ts`, `requireAuth.ts` e `auth.controller.ts`.

## 3. Proteção contra CSRF

**O que foi feito**

- Todas as requisições que alteram dados exigem um token CSRF (padrão de cookie duplicado, com a biblioteca `csrf-csrf`). O cliente pede o token em `GET /csrf-token` e o devolve em um cabeçalho nas requisições seguintes.
- O token é amarrado ao usuário da sessão, então um token de outra pessoa não serve.
- Em produção o cookie do token usa o prefixo `__Host-`, que o navegador só aceita com `secure` e sem escopo de subdomínio.
- Isso se soma ao `sameSite=lax` do cookie de sessão e ao CORS restrito a uma origem.

**Por quê:** como a autenticação usa cookies, o navegador os envia sozinho em qualquer requisição para a API, inclusive as disparadas por outro site. O token CSRF prova que a requisição saiu do nosso frontend (CWE-352).

**Onde:** `backend/src/middlewares/csrf.ts` e a rota `/csrf-token` em `routes/index.ts`.

## 4. Autorização e controle de acesso

É a área mais trabalhada, porque falhas de controle de acesso são a primeira da lista do OWASP (A01).

**Três camadas, nesta ordem**

1. **Estar logado** (`requireAuth`).
2. **Participar do projeto** (`requireProjectAccess`). Só membros e administradores entram. Quem não participa recebe 404, como se o projeto não existisse, para não revelar que ele existe.
3. **Ter o papel certo** (`requireRole`). Administrador e analista podem criar e alterar. Visualizador só lê.

**Regras extras para ações destrutivas**

| Ação | Quem pode |
| --- | --- |
| Excluir projeto | Dono ou administrador |
| Excluir achado | Quem registrou, dono do projeto ou administrador |
| Excluir evidência | Quem enviou, dono do projeto ou administrador |
| Adicionar membro | Dono ou administrador |
| Remover membro | Dono ou administrador. Cada membro também pode sair sozinho. O dono não pode ser removido |

**Contra acesso a dados de outros projetos (CWE-639)**

- Toda consulta de ativo, achado e evidência inclui o `projectId` no filtro. Sem isso, um membro do projeto A poderia ler ou apagar dados do projeto B só trocando o ID na URL.
- Ao ligar um achado a um ativo ou a um responsável, o servidor confere que ambos pertencem ao mesmo projeto.
- Uma evidência só é entregue se pertencer ao achado e o achado pertencer ao projeto da URL.

**Contra preenchimento de campos indevidos (CWE-915)**

- Os schemas de entrada só aceitam os campos permitidos. Status, autor do achado e projeto nunca vêm do cliente: o autor sai da sessão, o projeto sai da URL e o status só muda pelo endpoint próprio.

**Integridade do fluxo de status**

- O servidor valida cada transição de status contra uma tabela de mudanças permitidas, então não dá para pular etapas por uma chamada direta à API.
- A mudança de status e o registro no histórico acontecem numa única transação, e a atualização só vale se o status ainda for o que foi lido. Se alguém mudou antes, a resposta é 409.

**Onde:** `backend/src/middlewares/requireProjectAccess.ts` e `requireRole.ts`, e os arquivos `*.service.ts` de cada recurso.

## 5. Validação de entrada e injeção

**O que foi feito**

- Toda rota valida corpo, parâmetros e query com zod antes de chegar ao controller. Isso cobre tipo, tamanho máximo, formato dos UUIDs, valores permitidos de enums e datas.
- A categoria OWASP de um achado só é aceita se existir no catálogo. CWE e CVE são conferidos pelo formato.
- Não há SQL escrito à mão no projeto. Tudo passa pelo Prisma, que usa consultas parametrizadas, inclusive nas buscas por texto (CWE-89).
- Há limites para evitar abuso: corpo JSON de no máximo 100 KB, tamanho de página de no máximo 100 itens e janela de "achados parados" entre 1 e 365 dias.
- O TypeScript roda com `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`, o que pega uma classe de erros antes da execução.

**Por quê:** nenhum dado que vem de fora é confiável. Validar na entrada, de forma centralizada, é mais seguro do que lembrar de validar em cada ponto. Relaciona-se com A03 (injeção) e A04 (design inseguro).

**Sobre XSS:** a API só responde JSON e não monta HTML, então não há XSS refletido nela. Mas títulos e descrições de achados são texto livre guardado no banco, e o risco de XSS armazenado passa a existir no frontend, que precisará escapar esse conteúdo ao exibi-lo. Isso fica como requisito para quando o frontend for construído.

**Onde:** arquivos `*.schema.ts` e `backend/src/middlewares/validate.ts`.

## 6. Upload de evidências

Arquivo enviado por usuário deve ser tratado como entrada hostil (CWE-434). O fluxo foi pensado assim:

1. A **permissão é conferida antes** de o servidor ler o corpo da requisição.
2. O arquivo é lido **em memória**, com limite de 5 MB, um arquivo por envio e nenhum campo de texto junto.
3. O tipo é descoberto **pelo conteúdo** (os primeiros bytes do arquivo), ignorando a extensão e o tipo informado pelo cliente, que são fáceis de forjar.
4. Só são aceitos PNG, JPEG, WEBP, GIF, PDF e texto puro (UTF-8 sem byte nulo). SVG, HTML, ZIP e executáveis são recusados de propósito: SVG e HTML podem carregar script.
5. Só depois da validação o arquivo vai ao disco, com um **nome gerado pelo servidor** (UUID mais a extensão validada). O nome enviado pelo usuário nunca é usado como caminho (CWE-22). O código ainda confere que o nome não sai da pasta de uploads, e a gravação falha se o arquivo já existir.
6. As permissões do arquivo no disco são restritas (`640`, e `750` na pasta).
7. O nome original é limpo (sem pastas, aspas e caracteres de controle) e guardado só para exibição.
8. Cada achado aceita no máximo 10 evidências.

**No download**, o arquivo sai sempre como anexo (`attachment`), com o tipo vindo do conteúdo validado e não da extensão. Os cabeçalhos pedem `Cache-Control: private, no-store` e `Cross-Origin-Resource-Policy: same-site`.

**Limpeza:** se o banco falhar depois de gravar o arquivo, o arquivo é removido. Quando um achado, uma evidência ou um projeto é excluído, os arquivos correspondentes também saem do disco.

**Onde:** `backend/src/resources/evidence/` e `backend/src/lib/storage.ts`.

## 7. Tratamento de erros e vazamento de informação

- Erros inesperados viram uma resposta 500 genérica. O detalhe fica só no log do servidor (CWE-209).
- Erros de validação informam o campo e a mensagem, mas não devolvem o valor que foi enviado.
- O formato de erro é padronizado, e o Helmet remove o cabeçalho que anuncia que o servidor usa Express.
- Rotas inexistentes respondem 404 em JSON, sem página de erro com detalhes do servidor.

**Onde:** `backend/src/middlewares/errorHandler.ts` e `notFound.ts`.

## 8. Configuração e segredos

- As variáveis de ambiente são validadas na inicialização com `envalid`. A API não sobe sem `DATABASE_URL`.
- `SESSION_SECRET` e `CSRF_SECRET` precisam ter pelo menos 32 caracteres. Os valores de desenvolvimento embutidos no código só valem fora de produção: em produção os segredos são obrigatórios.
- `COOKIE_SECURE` é verdadeiro por padrão em produção.
- O `.env` está fora do git e o repositório traz um `.env.example` só com valores de exemplo. A imagem Docker também não leva o `.env`.
- O `compose.yaml` se recusa a subir se as senhas do banco não estiverem definidas.
- Um scanner de segredos (gitleaks) roda antes de cada commit e na CI.

Relaciona-se com A05 (configuração incorreta de segurança) e A02.

## 9. Cabeçalhos HTTP e CORS

- O Helmet aplica o conjunto padrão de cabeçalhos de segurança.
- O CORS aceita uma única origem, definida em `CORS_ORIGIN`, com credenciais. Nenhuma outra origem consegue ler respostas autenticadas pelo navegador.

**Onde:** `backend/src/app.ts`.

## 10. Infraestrutura

- A imagem de produção é construída em estágios, instala só as dependências de produção, leva apenas o código compilado e roda com o usuário `node`, sem privilégios de root. O código fica com dono root, em somente leitura para o processo.
- No `compose.yaml`, o MySQL e o Redis são publicados só em `127.0.0.1`, e não ficam acessíveis pela rede.

## 11. Cadeia de suprimentos e ciclo de desenvolvimento seguro

Dependências e processo também são superfície de ataque. O que existe:

- **CI a cada pull request:** typecheck, lint, formatação, build e testes.
- **Workflow de segurança** (em push, pull request e toda segunda-feira): `npm audit` das dependências de produção, falhando a partir de severidade alta; varredura de segredos com gitleaks; e revisão de dependências nos pull requests, também falhando a partir de severidade alta.
- **Dependabot** abre atualizações semanais de dependências e de GitHub Actions.
- **Instalação reprodutível:** a CI usa `npm ci`, que respeita o `package-lock.json`.
- **Correção de vulnerabilidade conhecida:** uma dependência indireta (`effect`) tinha uma falha de ReDoS (GHSA-7589-6fvf-x4pw). O projeto fixou a versão corrigida com `overrides` no `package.json`.
- **Hooks do Git (Husky):** antes do commit rodam lint-staged e gitleaks; a mensagem do commit é validada no padrão Conventional Commits; antes do push rodam as verificações completas.
- **`SECURITY.md`** define como reportar vulnerabilidades do próprio VulnCase, por relato privado e não por issue pública.

Relaciona-se com A06 (componentes vulneráveis e desatualizados) e com o Secure SDLC estudado no módulo.

## Resumo pelo OWASP Top 10 (2021)

| Categoria | Situação | O que cobre |
| --- | --- | --- |
| A01 Quebra de controle de acesso | Coberta | Participação no projeto, papéis, filtro por projeto em toda consulta, 404 para quem não participa, regras para ações destrutivas |
| A02 Falhas criptográficas | Coberta na aplicação | bcrypt, cookies seguros, segredos validados. O HTTPS em si depende de onde a API for publicada |
| A03 Injeção | Coberta | Validação com zod, Prisma sem SQL cru |
| A04 Design inseguro | Coberta | Máquina de estados, limites de tamanho e quantidade, escopo por projeto, lista de tipos de arquivo permitidos |
| A05 Configuração incorreta | Coberta | Helmet, CORS restrito, erros genéricos, variáveis validadas, container sem root |
| A06 Componentes vulneráveis | Coberta | `npm audit`, Dependabot, revisão de dependências, versão fixada contra falha conhecida |
| A07 Falhas de autenticação | Coberta | bcrypt, limite de tentativas, mensagem única, sessão regenerada, defesa contra timing |
| A08 Falhas de integridade | Parcial | Conteúdo de upload validado e instalações com `npm ci`. Não há assinatura de artefatos |
| A09 Falhas de log e monitoramento | Parcial | Há log de requisições e histórico de status, mas não há registro de auditoria de eventos de segurança |
| A10 SSRF | Não se aplica | A API não faz requisições para endereços informados pelo usuário |

## O que ainda não está coberto

- **Limite de tentativas em memória:** os contadores ficam na memória do processo e zeram ao reiniciar, e não há configuração de `trust proxy`. Atrás de um proxy, todos os acessos pareceriam vir do mesmo IP.
- **Sem auditoria de segurança:** logins, falhas de permissão e exclusões não são registrados de forma consultável. Só as mudanças de status têm histórico.
- **Autenticação básica:** não há recuperação de senha, verificação em duas etapas, bloqueio de conta (só o limite por IP) nem checagem de senhas vazadas. A política de senha exige apenas o tamanho.
- **Enumeração de e-mails:** o cadastro avisa quando o e-mail já existe e a adição de membro avisa quando o usuário não existe (esta só para donos e administradores).
- **Validação de CWE e CVE:** só o formato é conferido, enquanto OWASP é conferida contra o catálogo.
- **Upload:** os arquivos ficam em disco local, sem criptografia e sem verificação por antivírus. O tipo é conferido, mas o conteúdo de PDFs e textos não é inspecionado. Por isso o download é sempre como anexo.
- **Papéis:** não existe endpoint para promover ou rebaixar usuários.
- **Docker de produção (não testado):** a pasta de uploads é relativa e o processo roda sem root sobre código de dono root, então é provável que o upload falhe por permissão dentro do container.
- **XSS armazenado:** depende do frontend escapar títulos e descrições, que ainda não existe.

A lista geral de pendências do projeto está em [`status.md`](status.md).