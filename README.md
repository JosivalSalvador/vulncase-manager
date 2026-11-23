# VulnCase Manager

Ferramenta para registrar, priorizar e acompanhar vulnerabilidades e achados de segurança. É o projeto da **Trilha 3 (VulnCase)** do Projeto Integrador do módulo Segurança Aplicada e Privacidade.

> Estado em 21/11/2026 (commit `932cbcb`). Este documento é um retrato do momento e vai mudar conforme o projeto avançar.

## O problema que a ferramenta resolve

Achados de segurança costumam ficar espalhados em planilhas, anotações, PDFs e mensagens de equipe. O VulnCase concentra tudo num só lugar: a equipe cadastra um projeto e seus ativos, registra cada vulnerabilidade com severidade, status, responsável e correção proposta, anexa evidências e acompanha o ciclo de correção até a verificação.

## Onde o projeto está hoje

Por enquanto existe apenas o **backend** (uma API REST). O frontend ainda não foi começado.

**Já feito**

- Cadastro, login e logout com sessão, proteção CSRF e limite de tentativas
- Projetos, ativos e membros do projeto, com controle de acesso por papel e por participação
- Achados com severidade, status, responsável, correção proposta, prazo e vínculo com OWASP, CWE e CVE
- Mudança de status com regras de transição e histórico completo
- Evidências por achado (upload, listagem, download e exclusão), com validação do conteúdo do arquivo
- Estatísticas por projeto e visão geral, com contagem de achados vencidos e parados
- Catálogo de referência de OWASP Top 10 (2021 e 2025) e de CWE

**Ainda falta**

- Deduplicação de achados (em andamento)
- Exportação de relatório
- Resumo automático dos achados
- Frontend
- Mais testes automatizados

O detalhamento, com a comparação contra o que o enunciado pede, está em [`docs/status.md`](docs/status.md).

## Stack

| Parte | Tecnologia |
| --- | --- |
| Linguagem e runtime | TypeScript, Node.js 24 |
| API | Express 5 |
| Banco de dados | MySQL 8.4, acessado com Prisma 7 |
| Sessões | Redis 8, com `express-session` e `connect-redis` |
| Validação | zod |
| Segurança | bcryptjs, helmet, csrf-csrf, express-rate-limit, cors |
| Upload | multer e file-type |
| Testes | Vitest |
| Qualidade | ESLint, Prettier, Husky, lint-staged e commitlint |
| Automação | GitHub Actions e Dependabot |

## Estrutura do repositório

```
vulncase-manager/
├── backend/
│   ├── prisma/          schema e migrations do banco
│   ├── src/
│   │   ├── resources/   um módulo por recurso (auth, projects, findings...)
│   │   ├── middlewares/ autenticação, permissões, validação, CSRF, erros
│   │   ├── lib/         conexões (Prisma, Redis) e armazenamento de arquivos
│   │   ├── utils/       paginação, erros, variáveis de ambiente
│   │   └── routes/      montagem das rotas
│   ├── compose.yaml     MySQL e Redis para desenvolvimento
│   ├── Dockerfile
│   └── .env.example
├── docs/                documentação do estado atual
├── .github/             workflows de CI e segurança, Dependabot
└── SECURITY.md          como reportar vulnerabilidades
```

A explicação de como o backend foi organizado está em [`docs/arquitetura.md`](docs/arquitetura.md).

## Como rodar o backend

Você precisa de Node.js 24 e Docker.

1. Entre na pasta do backend e crie o arquivo de ambiente:

   ```bash
   cd backend
   cp .env.example .env
   ```

   Edite o `.env`: troque as senhas do MySQL (lembre de manter a senha também dentro da `DATABASE_URL`) e gere os dois segredos com pelo menos 32 caracteres:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Use um valor diferente para `SESSION_SECRET` e para `CSRF_SECRET`.

2. Suba o MySQL e o Redis:

   ```bash
   docker compose up -d
   ```

3. Instale as dependências, gere o client do Prisma e aplique as migrations:

   ```bash
   npm install
   npx prisma generate
   npx prisma migrate deploy
   ```

4. Inicie a API em modo de desenvolvimento:

   ```bash
   npm start
   ```

   A API sobe em `http://localhost:3333`. Para conferir, acesse `http://localhost:3333/health`.

As evidências enviadas ficam na pasta definida em `UPLOAD_DIR` (por padrão `uploads/`, que não vai para o git).

## Scripts do backend

| Comando | O que faz |
| --- | --- |
| `npm start` | Sobe a API em desenvolvimento, reiniciando ao salvar |
| `npm run build` | Compila o TypeScript para `dist/` |
| `npm run start:prod` | Roda a versão compilada |
| `npm run typecheck` | Confere os tipos sem gerar arquivos |
| `npm run lint` | Roda o ESLint |
| `npm run format:check` | Confere a formatação com o Prettier |
| `npm test` | Roda os testes com cobertura |

## Qualidade e segurança no desenvolvimento

- A CI roda typecheck, lint, formatação, build e testes a cada pull request.
- Um workflow separado de segurança faz auditoria de dependências (`npm audit`), varredura de segredos com gitleaks e revisão de dependências nos pull requests. Ele também roda toda segunda-feira.
- O Husky executa lint-staged e a varredura de segredos antes de cada commit, valida a mensagem do commit (convenção Conventional Commits) e roda as verificações completas antes do push.
- O Dependabot abre atualizações semanais de dependências.

## Documentação

- [`docs/status.md`](docs/status.md): o que está feito, o que falta e o que fica para depois
- [`docs/arquitetura.md`](docs/arquitetura.md): como o projeto foi estruturado e o modelo de dados
- [`docs/seguranca.md`](docs/seguranca.md): decisões de segurança e o porquê de cada uma
- [`docs/api.md`](docs/api.md): lista de endpoints e permissões

Para reportar uma vulnerabilidade no próprio VulnCase, veja o [`SECURITY.md`](SECURITY.md).