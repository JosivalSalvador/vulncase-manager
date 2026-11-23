# Status do projeto

> Estado em 21/11/2026 (commit `932cbcb`). Este documento é um retrato do momento e deve ser atualizado a cada avanço.

O projeto segue a **Trilha 3 (VulnCase)** do Projeto Integrador. Hoje existe só o backend, uma API REST. O frontend ainda não foi começado.

Em resumo: todos os requisitos mínimos do enunciado estão cobertos pela API. Dos adicionais, dois estão prontos, um está em andamento e dois faltam. O que mais pesa agora é o frontend, os testes e a documentação.

## Requisitos mínimos do enunciado

| Requisito | Situação | Como foi feito |
| --- | --- | --- |
| Cadastro de projeto ou ativo | Feito | CRUD de projetos (com busca e paginação) e de ativos dentro do projeto. O ativo tem tipo (web, mobile, rede ou código) e um identificador livre, como URL, IP ou repositório. Código em `backend/src/resources/projects` e `assets`. |
| Cadastro de achados | Feito | Título, descrição, severidade, correção proposta, prazo, ativo e responsável. Dá para listar com filtros, editar e excluir. Código em `backend/src/resources/findings`. |
| Severidade | Feito | Cinco níveis: crítica, alta, média, baixa e informativa. A listagem já vem ordenada da mais grave para a menos grave. |
| Status | Feito | Seis estados: aberto, em andamento, corrigido, verificado, risco aceito e falso positivo. As mudanças seguem uma tabela de transições permitidas e cada uma é gravada num histórico, junto de quem fez. |
| Responsável | Feito | O responsável precisa ser membro do projeto. Se o membro sai, os achados dele ficam sem responsável. |
| Descrição da correção proposta | Feito | Campo de remediação em cada achado. |
| Visualização consolidada | Feito na API | Os endpoints de estatísticas entregam os números prontos, por projeto e na visão geral. Ainda não existe tela para mostrá-los. |

Também está pronto o armazenamento de **evidências**, que o enunciado cita entre as coisas que a ferramenta "pode fazer": upload, listagem, download e exclusão, com validação do conteúdo do arquivo.

## Funcionalidades adicionais do enunciado

| Adicional | Situação | Observação |
| --- | --- | --- |
| Associação com OWASP, CWE ou CVE | Feito | A categoria OWASP é validada contra um catálogo (Top 10 de 2021 e de 2025). CWE e CVE são validados só pelo formato. Há endpoints de consulta do catálogo OWASP e CWE. |
| Dashboard simples | Parcial | Os dados existem (totais por severidade e status, abertos, vencidos, parados e contagem por categoria OWASP), mas falta a tela. |
| Deduplicação básica | Em andamento | Ainda não está na `main`. |
| Exportação de relatório | Falta | Não existe endpoint de exportação. |
| Resumo automático dos achados | Falta | As estatísticas devolvem só contagens, sem um resumo em texto. |

## Relação com as disciplinas do módulo

O enunciado pede que a ferramenta mobilize pelo menos duas disciplinas e relacione a terceira quando fizer sentido.

- **Projeto e Desenvolvimento de Código Seguro:** senhas com bcrypt, validação de toda entrada com zod, autenticação e autorização por papel e por participação no projeto, sessão em Redis, e uma esteira de CI com auditoria de dependências e varredura de segredos.
- **Segurança de Aplicações Web e Móveis:** proteção CSRF, controle de acesso que impede um usuário de alcançar dados de outro projeto, upload de arquivos tratado como entrada hostil, cabeçalhos de segurança e uso do OWASP Top 10 como referência dos achados.
- **Segurança de Redes:** a relação é mais leve. O tipo de ativo "rede" permite registrar achados de varredura e exposição, mas a ferramenta não faz varredura, o que o enunciado também não espera.

As decisões de segurança estão explicadas em [`seguranca.md`](seguranca.md).

## Limitações conhecidas

- **Testes:** existem só 2, que cobrem a rota de saúde e o 404. Nada cobre autenticação, permissões, transições de status ou upload.
- **Limite de tentativas:** usa a memória do processo, não o Redis, então zera ao reiniciar. Também não há configuração de `trust proxy`, o que importa se a API ficar atrás de um proxy.
- **Prazo vencido:** é calculado em UTC. No horário do Brasil, um achado com prazo de hoje passa a contar como vencido a partir das 20h.
- **Papéis:** o cadastro sempre cria o usuário como analista e não há endpoint para promover alguém a administrador ou rebaixar a visualizador. Hoje isso só se faz direto no banco.
- **Validação de CWE e CVE:** só o formato é conferido, enquanto a categoria OWASP é conferida contra o catálogo.
- **Cadastro:** responder "e-mail já cadastrado" permite descobrir quais e-mails existem. O limite de tentativas atenua o problema.
- **Dependência sem uso:** o pacote `uuid` está declarado mas nenhum arquivo o importa.
- **Docker de produção (não testado):** a imagem roda como usuário `node` com o código pertencendo ao root, e a pasta de uploads é relativa (`uploads`). É provável que o upload falhe por permissão dentro do container. O `compose.yaml` também só sobe MySQL e Redis, sem a API e sem volume para os uploads.

## Próximos passos

1. Concluir a deduplicação de achados.
2. Implementar a exportação de relatório e o resumo automático.
3. Escrever testes automatizados, começando pelas transições de status, pela autenticação e pelas permissões.
4. Construir o frontend: login e cadastro, lista de projetos, tela do projeto (ativos, membros e achados), detalhe do achado (status, histórico e evidências) e o dashboard com os dados de `/stats`.
5. Corrigir as limitações acima, principalmente o limite de tentativas no Redis, o cálculo do prazo e o Dockerfile de produção.
6. Manter esta documentação atualizada.