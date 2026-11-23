# Modelagem de ameaças (STRIDE)

Escopo: o backend do VulnCase (API Express, MySQL, Redis e uploads em disco). O frontend ainda não existe e entra em um adendo depois. O método é o STRIDE aplicado a cada fronteira de confiança: para cada ameaça, o controle que existe hoje e o arquivo onde ele está.

## 1. O que protegemos

- **Achados de vulnerabilidade** (descrição, correção, evidências). Um achado aberto é um mapa de ataque, então é o dado mais sensível do sistema.
- **Contas e sessões** de quem registra e corrige os achados.
- **Histórico de status**, que prova quem mudou o quê e quando.
- **Disponibilidade da API**, para a equipe conseguir acompanhar as correções.

## 2. Fronteiras de confiança

| # | Fronteira | O que atravessa |
|---|-----------|-----------------|
| F1 | Cliente (não confiável) → API | JSON, query string, parâmetros, upload multipart, cookies |
| F2 | API → MySQL (Prisma) | consultas e dados de todos os projetos |
| F3 | API → Redis | sessões dos usuários |
| F4 | API → disco | arquivos de evidência |
| F5 | Repositório → CI → imagem | código, dependências e segredos |

## 3. Ameaças e controles

| STRIDE | Ameaça | Controle existente | Onde |
|--------|--------|--------------------|------|
| **S**poofing | Adivinhar ou forçar senhas | bcrypt com custo 12; 10 falhas por 15 min no login e 10 cadastros por hora | `backend/src/resources/auth/auth.service.ts`, `backend/src/middlewares/rateLimit.ts` |
| S | Descobrir se um e-mail existe pelo login | mesma mensagem 401 para os dois erros e hash falso para igualar o tempo de resposta | `backend/src/resources/auth/auth.service.ts` |
| S | Fixação ou roubo de sessão | sessão nova a cada login; cookie `httpOnly`, `sameSite=lax` e `secure` em produção; sessão no Redis, 8 h; logout destrói | `backend/src/resources/auth/auth.controller.ts`, `backend/src/middlewares/session.ts` |
| S | CSRF (ação forjada por outro site) | token duplo amarrado ao usuário da sessão; cookie `__Host-` em produção | `backend/src/middlewares/csrf.ts`, `backend/src/app.ts` |
| **T**ampering | Injeção SQL e dados malformados | toda entrada (body, params, query) passa pelo zod antes do serviço; o Prisma parametriza as consultas | `backend/src/middlewares/validate.ts`, `backend/src/resources/findings/findings.schema.ts` |
| T | Enviar campos que não deveria (ex.: `role` no cadastro) | o zod descarta campos fora do schema | `backend/src/resources/auth/auth.schema.ts` |
| T | Pular o fluxo de status ou disputar a mudança | matriz de transições; atualização condicionada ao status lido, na mesma transação do histórico | `backend/src/resources/findings/findings.transitions.ts`, `backend/src/resources/findings/findings.service.ts` |
| T | Arquivo malicioso como evidência | tipo pelo conteúdo, lista curta (png, jpg, webp, gif, pdf, txt), SVG/HTML/ZIP recusados, 5 MB, nome gerado (uuid) e bloqueio de path traversal | `backend/src/resources/evidence/evidence.detect.ts`, `backend/src/resources/evidence/evidence.upload.ts`, `backend/src/lib/storage.ts` |
| T | Fórmula ou Markdown injetado no relatório exportado | CSV neutraliza células iniciadas por `=`, `+`, `-`, `@`; Markdown escapa o texto do usuário | `backend/src/resources/reports/reports.format.ts` |
| **R**epudiation | Negar que mudou um status | cada troca grava quem, de, para e quando; o achado guarda o relator; não existe rota para editar ou apagar o histórico | `backend/prisma/schema.prisma`, `backend/src/resources/findings/findings.router.ts` |
| R | Rastrear quem chamou o quê | log de acesso `combined` em produção | `backend/src/app.ts` |
| **I**nformation disclosure | Ver projeto, achado ou evidência de outra equipe (IDOR) | `requireProjectAccess` em todas as rotas de projeto; quem não é membro recebe 404, sem revelar que o recurso existe | `backend/src/middlewares/requireProjectAccess.ts`, `backend/src/resources/projects/projects.router.ts`, `backend/src/resources/findings/findings.idor.integration.test.ts` |
| I | Vazamento em mensagens de erro | erro 500 genérico, detalhe só no log; o zod devolve campo e mensagem, nunca o valor enviado | `backend/src/middlewares/errorHandler.ts` |
| I | Evidência executada ou guardada em cache | sempre `attachment`, tipo vindo do conteúdo validado, `no-store`, `Cross-Origin-Resource-Policy` | `backend/src/resources/evidence/evidence.controller.ts` |
| I | Segredos no repositório ou fracos | `gitleaks` no pre-commit e na CI; `.env` fora do git; segredos com no mínimo 32 caracteres | `.husky/pre-commit`, `.github/workflows/security.yml`, `backend/src/utils/getEnv.ts` |
| **D**enial of service | Corpo ou arquivo gigante, listas sem fim | JSON até 100 KB; upload até 5 MB, 1 arquivo; paginação com máximo de 100 | `backend/src/app.ts`, `backend/src/resources/evidence/evidence.upload.ts`, `backend/src/utils/pagination.ts` |
| D | Dependência vulnerável | `npm audit` e `dependency-review` na CI, Dependabot toda semana | `.github/workflows/security.yml`, `.github/dependabot.yml` |
| **E**levation of privilege | Usuário comum virar ADMIN | papel padrão `ANALYST`; só ADMIN muda papéis; o papel é relido do banco a cada requisição | `backend/prisma/schema.prisma`, `backend/src/resources/users/users.router.ts`, `backend/src/middlewares/requireAuth.ts` |
| E | VIEWER alterar dados | `requireRole("ADMIN", "ANALYST")` nas rotas de escrita | `backend/src/middlewares/requireRole.ts`, `backend/src/resources/projects/projects.router.ts` |
| E | Gerenciar membros sem ser dono do projeto | só o dono ou um ADMIN | `backend/src/resources/members/members.service.ts` |
| E | Invasor ganhar root no container | imagem de produção roda como `node`, só com dependências de produção | `backend/Dockerfile` |

## 4. Riscos que ficam (e por quê)

- **Limite de tentativas em memória e por IP.** Atrás de um proxy, sem `trust proxy`, todos pareceriam o mesmo IP; também não há bloqueio por conta. A configuração do proxy está prevista na etapa de infraestrutura.
- **Senha só com tamanho (8 a 72)**, sem checagem de senhas vazadas e sem segundo fator. Para um protótipo é aceitável.
- **O cadastro revela se o e-mail existe** (409). Troca aceita por usabilidade, e o limite de 10 cadastros por hora reduz a enumeração.
- **Evidências sem antivírus** e em disco local. O tipo é conferido pelo conteúdo, mas o conteúdo em si não é analisado.
- **Auditoria só do status.** As demais ações aparecem apenas no log de acesso, que não é imutável nem centralizado.
- **Sem limite global de requisições**, só nas rotas de autenticação.
- **XSS armazenado:** a API só devolve JSON, então o risco passa para o frontend, que deve exibir título, descrição e nome de ativo sempre como texto.
- **ADMIN enxerga todos os projetos**, por desenho.