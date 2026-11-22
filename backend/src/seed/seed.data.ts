import type {
  AssetType,
  FindingStatus,
  Role,
  Severity,
} from "../generated/prisma/enums.js"

// Senha de todos os usuários de demonstração. É conhecida de propósito, e por
// isso o seed se recusa a rodar com NODE_ENV=production.
export const DEMO_PASSWORD = "senhaSegura123"

export type DemoUserKey = "admin" | "ana" | "bruno" | "carla"

export interface DemoUser {
  key: DemoUserKey
  fullname: string
  email: string
  role: Role
}

export interface DemoAsset {
  name: string
  type: AssetType
  identifier: string
}

export interface DemoEvidence {
  fileName: string
  content: string
}

// Mudança de status, contada em dias atrás (a data de hoje muda a cada seed).
export interface DemoStep {
  to: FindingStatus
  daysAgo: number
  by: DemoUserKey
}

export interface DemoFinding {
  asset: string
  title: string
  description: string
  severity: Severity
  remediation: string
  owaspCategory: string | null
  cwe: string | null
  cve: string | null
  reporter: DemoUserKey
  assignee: DemoUserKey | null
  createdDaysAgo: number
  // Prazo em dias a partir de hoje. Negativo = já vencido.
  dueInDays: number | null
  // Do primeiro para o último. O status final é o do último passo (ou OPEN).
  steps: DemoStep[]
  evidence?: DemoEvidence[]
}

export interface DemoProject {
  name: string
  description: string
  owner: DemoUserKey
  members: DemoUserKey[]
  assets: DemoAsset[]
  findings: DemoFinding[]
}

export const demoUsers: DemoUser[] = [
  {
    key: "admin",
    fullname: "Admin Demo",
    email: "admin@vulncase.test",
    role: "ADMIN",
  },
  {
    key: "ana",
    fullname: "Ana Ribeiro",
    email: "ana@vulncase.test",
    role: "ANALYST",
  },
  {
    key: "bruno",
    fullname: "Bruno Tavares",
    email: "bruno@vulncase.test",
    role: "ANALYST",
  },
  {
    key: "carla",
    fullname: "Carla Nogueira",
    email: "carla@vulncase.test",
    role: "VIEWER",
  },
]

const portalAluno: DemoProject = {
  name: "Portal do Aluno",
  description:
    "Sistema acadêmico web da instituição: matrícula, notas e fórum de dúvidas. Disciplinas em foco: Web e Código Seguro.",
  owner: "ana",
  members: ["ana", "bruno", "carla"],
  assets: [
    {
      name: "Portal web",
      type: "WEB",
      identifier: "https://portal.exemplo.edu.br",
    },
    {
      name: "API REST de notas",
      type: "WEB",
      identifier: "https://api.portal.exemplo.edu.br",
    },
    {
      name: "Repositório portal-backend",
      type: "CODE",
      identifier: "github.com/exemplo-edu/portal-backend",
    },
  ],
  findings: [
    {
      asset: "Portal web",
      title: "SQL Injection no login do portal",
      description:
        "O campo de matrícula do formulário de login é concatenado direto na consulta SQL. Com a entrada ' OR '1'='1 é possível entrar sem senha, e a mesma falha permite ler outras tabelas do banco.",
      severity: "CRITICAL",
      remediation:
        "Trocar a concatenação por consultas parametrizadas (prepared statements), validar o formato da matrícula no servidor e reduzir as permissões do usuário do banco usado pela aplicação.",
      owaspCategory: "A03:2021",
      cwe: "CWE-89",
      cve: null,
      reporter: "ana",
      assignee: "ana",
      createdDaysAgo: 45,
      dueInDays: -10,
      steps: [{ to: "IN_PROGRESS", daysAgo: 40, by: "ana" }],
      evidence: [
        {
          fileName: "requisicao-sqli-login.txt",
          content: [
            "POST /login HTTP/1.1",
            "Host: portal.exemplo.edu.br",
            "Content-Type: application/x-www-form-urlencoded",
            "",
            "matricula=2024001&senha=' OR '1'='1",
            "",
            "HTTP/1.1 302 Found",
            "Location: /painel",
            "",
            "Resultado: acesso ao painel sem conhecer a senha.",
            "",
          ].join("\n"),
        },
      ],
    },
    {
      asset: "Portal web",
      title: "XSS refletido na busca de disciplinas",
      description:
        "O termo digitado na busca de disciplinas volta na página sem escape de HTML. Um link com uma tag script no parâmetro q executa JavaScript no navegador de quem clicar, o que permite roubar a sessão.",
      severity: "HIGH",
      remediation:
        "Escapar a saída conforme o contexto (HTML, atributo ou URL), usar o escape automático do framework de templates e adicionar uma Content-Security-Policy restritiva.",
      owaspCategory: "A03:2021",
      cwe: "CWE-79",
      cve: null,
      reporter: "bruno",
      assignee: "bruno",
      createdDaysAgo: 38,
      dueInDays: 7,
      steps: [],
    },
    {
      asset: "Portal web",
      title: "CSRF na troca de e-mail da conta",
      description:
        "A troca de e-mail da conta é feita por um POST sem token anti-CSRF. Uma página maliciosa pode enviar o formulário em nome do aluno logado e, em seguida, pedir a recuperação de senha para o novo e-mail.",
      severity: "MEDIUM",
      remediation:
        "Exigir token CSRF em todas as requisições que alteram estado, usar cookie SameSite Lax ou Strict e pedir a senha atual para trocar o e-mail.",
      owaspCategory: "A01:2021",
      cwe: "CWE-352",
      cve: null,
      reporter: "ana",
      assignee: "ana",
      createdDaysAgo: 30,
      dueInDays: -14,
      steps: [
        { to: "IN_PROGRESS", daysAgo: 27, by: "ana" },
        { to: "FIXED", daysAgo: 6, by: "ana" },
      ],
    },
    {
      asset: "Portal web",
      title: "Cookie de sessão sem os atributos Secure e HttpOnly",
      description:
        "O cookie de sessão é enviado sem os atributos Secure e HttpOnly. Ele pode trafegar em HTTP puro e ser lido por qualquer script da página.",
      severity: "MEDIUM",
      remediation:
        "Definir Secure, HttpOnly e SameSite no cookie de sessão e forçar HTTPS com HSTS.",
      owaspCategory: "A05:2021",
      cwe: "CWE-614",
      cve: null,
      reporter: "bruno",
      assignee: "bruno",
      createdDaysAgo: 50,
      dueInDays: null,
      steps: [
        { to: "IN_PROGRESS", daysAgo: 47, by: "bruno" },
        { to: "FIXED", daysAgo: 35, by: "bruno" },
        { to: "VERIFIED", daysAgo: 30, by: "ana" },
      ],
    },
    {
      asset: "Repositório portal-backend",
      title: "Chave de API do serviço de e-mail exposta no repositório",
      description:
        "O arquivo de configuração versionado contém a chave de API do serviço de envio de e-mails em texto puro. Ela continua no histórico do Git mesmo que o arquivo seja apagado.",
      severity: "HIGH",
      remediation:
        "Revogar e gerar uma nova chave, guardar segredos em variáveis de ambiente ou em um cofre e limpar o histórico do Git. Adicionar um verificador de segredos, como o gitleaks, à pipeline.",
      owaspCategory: "A07:2021",
      cwe: "CWE-798",
      cve: null,
      reporter: "ana",
      assignee: "ana",
      createdDaysAgo: 25,
      dueInDays: -2,
      steps: [],
    },
    {
      asset: "API REST de notas",
      title: "Aluno acessa as notas de outro pelo id na URL (IDOR)",
      description:
        "A rota GET /alunos/{id}/notas devolve as notas do id informado sem conferir se ele pertence ao aluno logado. Basta trocar o número na URL para ler as notas de qualquer colega.",
      severity: "HIGH",
      remediation:
        "Validar a posse do recurso no servidor em toda consulta (o id vem da sessão, não da URL) e negar por padrão. Cobrir o caso com testes automatizados de autorização.",
      owaspCategory: "A01:2021",
      cwe: "CWE-639",
      cve: null,
      reporter: "bruno",
      assignee: "bruno",
      createdDaysAgo: 20,
      dueInDays: 3,
      steps: [{ to: "IN_PROGRESS", daysAgo: 15, by: "bruno" }],
    },
    {
      asset: "Portal web",
      title: "Cabeçalhos de segurança ausentes (X-Frame-Options e CSP)",
      description:
        "O scanner indicou a falta de X-Frame-Options e Content-Security-Policy. Na conferência, o proxy reverso da instituição já injeta os dois cabeçalhos, então o alerta veio de uma leitura direto no servidor da aplicação.",
      severity: "LOW",
      remediation:
        "Nenhuma ação necessária. Registrar no relatório que a proteção está no proxy reverso.",
      owaspCategory: "A05:2021",
      cwe: "CWE-1021",
      cve: null,
      reporter: "ana",
      assignee: null,
      createdDaysAgo: 15,
      dueInDays: null,
      steps: [{ to: "FALSE_POSITIVE", daysAgo: 12, by: "ana" }],
    },
  ],
}

const appSaudeMais: DemoProject = {
  name: "App Saúde+",
  description:
    "Aplicativo Android de agendamento de consultas e a API que o atende. Disciplina em foco: Móveis.",
  owner: "bruno",
  members: ["bruno", "ana"],
  assets: [
    {
      name: "App Android",
      type: "MOBILE",
      identifier: "br.exemplo.saudemais",
    },
    {
      name: "API de agendamentos",
      type: "WEB",
      identifier: "https://api.saudemais.exemplo.com.br",
    },
  ],
  findings: [
    {
      asset: "App Android",
      title: "Dados sensíveis gravados no log do aplicativo",
      description:
        "O app registra CPF e token de sessão com Log.d. Em um aparelho com depuração USB ligada, o adb logcat mostra esses dados, e outros apps com permissão de leitura de logs também podem vê-los.",
      severity: "HIGH",
      remediation:
        "Remover os logs de dados sensíveis, usar o R8 (ProGuard) para retirar as chamadas de log da versão de produção e criar uma regra de revisão de código contra log de dados pessoais.",
      owaspCategory: "A09:2021",
      cwe: "CWE-532",
      cve: null,
      reporter: "bruno",
      assignee: "bruno",
      createdDaysAgo: 33,
      dueInDays: -5,
      steps: [],
      evidence: [
        {
          fileName: "logcat-saudemais.txt",
          content: [
            "$ adb logcat -s SaudeMais",
            "",
            "D/SaudeMais: login ok cpf=000.000.000-00 token=eyJhbGciOiJIUzI1NiJ9.demo",
            "D/SaudeMais: GET /consultas?paciente=42",
            "",
          ].join("\n"),
        },
      ],
    },
    {
      asset: "App Android",
      title: "Token de sessão guardado sem criptografia",
      description:
        "O token fica em SharedPreferences em texto puro. Em um aparelho com root, ou a partir de um backup do aparelho, o arquivo pode ser lido e o token reutilizado.",
      severity: "HIGH",
      remediation:
        "Guardar o token no Android Keystore, por meio do EncryptedSharedPreferences, e usar tokens de vida curta com renovação.",
      owaspCategory: "A02:2021",
      cwe: "CWE-312",
      cve: null,
      reporter: "ana",
      assignee: "ana",
      createdDaysAgo: 28,
      dueInDays: 10,
      steps: [{ to: "IN_PROGRESS", daysAgo: 21, by: "ana" }],
    },
    {
      asset: "App Android",
      title: "Falta de certificate pinning nas chamadas à API",
      description:
        "O app aceita qualquer certificado assinado por uma autoridade instalada no aparelho. Em uma rede hostil, um proxy com certificado próprio consegue ler e alterar o tráfego da API.",
      severity: "MEDIUM",
      remediation:
        "Fixar o certificado ou a chave pública do servidor (pinning) pela configuração de segurança de rede do Android e prever a rotação do certificado.",
      owaspCategory: "A07:2021",
      cwe: "CWE-295",
      cve: null,
      reporter: "ana",
      assignee: "bruno",
      createdDaysAgo: 10,
      dueInDays: 25,
      steps: [],
    },
    {
      asset: "API de agendamentos",
      title: "API de agendamentos expõe consultas de outros pacientes",
      description:
        "A rota GET /consultas?paciente={id} responde com o histórico de consultas de qualquer paciente, sem checar quem está logado. Os dados são de saúde, o que agrava o impacto.",
      severity: "CRITICAL",
      remediation:
        "Obter o paciente a partir do token de sessão e ignorar o parâmetro enviado, respondendo 404 quando o recurso não for do usuário. Adicionar teste automatizado de autorização.",
      owaspCategory: "A01:2021",
      cwe: "CWE-639",
      cve: null,
      reporter: "bruno",
      assignee: "bruno",
      createdDaysAgo: 3,
      dueInDays: 2,
      steps: [],
    },
    {
      asset: "App Android",
      title: "App não detecta aparelhos com root",
      description:
        "O app funciona normalmente em aparelhos com root. A equipe aceitou o risco por enquanto, porque a detecção de root é fácil de burlar e o ganho real depende de corrigir antes o armazenamento do token.",
      severity: "LOW",
      remediation:
        "Revisar a decisão depois da correção do armazenamento do token. Se for retomada, usar a Play Integrity API em vez de verificações locais.",
      owaspCategory: "A05:2021",
      cwe: null,
      cve: null,
      reporter: "ana",
      assignee: null,
      createdDaysAgo: 55,
      dueInDays: null,
      steps: [{ to: "ACCEPTED_RISK", daysAgo: 50, by: "bruno" }],
    },
  ],
}

const redeManaus: DemoProject = {
  name: "Rede da Filial Manaus",
  description:
    "Varredura e revisão da rede da filial: roteador de borda, servidor de arquivos e Wi-Fi de visitantes. Disciplina em foco: Redes.",
  owner: "bruno",
  members: ["bruno", "carla"],
  assets: [
    {
      name: "Roteador de borda",
      type: "NETWORK",
      identifier: "10.20.0.1",
    },
    {
      name: "Servidor de arquivos",
      type: "NETWORK",
      identifier: "10.20.0.15",
    },
    {
      name: "Wi-Fi de visitantes",
      type: "NETWORK",
      identifier: "10.20.30.0/24",
    },
  ],
  findings: [
    {
      asset: "Roteador de borda",
      title: "Telnet exposto no roteador de borda",
      description:
        "A varredura mostrou a porta 23/tcp aberta no roteador de borda. O Telnet envia usuário e senha em texto puro, então qualquer pessoa na rede captura as credenciais de administração.",
      severity: "HIGH",
      remediation:
        "Desativar o Telnet, administrar o equipamento só por SSH com chaves, restringir o acesso de gerência a uma VLAN própria e trocar a senha de administrador.",
      owaspCategory: "A02:2021",
      cwe: "CWE-319",
      cve: null,
      reporter: "bruno",
      assignee: "bruno",
      createdDaysAgo: 35,
      dueInDays: -7,
      steps: [],
      evidence: [
        {
          fileName: "nmap-roteador-borda.txt",
          content: [
            "$ nmap -sV -p 1-1024 10.20.0.1",
            "",
            "Nmap scan report for 10.20.0.1",
            "PORT    STATE SERVICE  VERSION",
            "22/tcp  open  ssh      OpenSSH 7.4",
            "23/tcp  open  telnet   BusyBox telnetd",
            "80/tcp  open  http     lighttpd 1.4.35",
            "443/tcp open  ssl/http lighttpd 1.4.35",
            "",
          ].join("\n"),
        },
      ],
    },
    {
      asset: "Servidor de arquivos",
      title: "SMBv1 habilitado no servidor de arquivos",
      description:
        "O servidor de arquivos ainda aceita o protocolo SMBv1 e não tem a correção MS17-010. Isso o deixa exposto à falha explorada pelo EternalBlue (CVE-2017-0144), que permite execução remota de código.",
      severity: "CRITICAL",
      remediation:
        "Desativar o SMBv1, aplicar as atualizações do Windows, bloquear a porta 445 entre as redes e manter um inventário de patches.",
      owaspCategory: "A06:2021",
      cwe: null,
      cve: "CVE-2017-0144",
      reporter: "bruno",
      assignee: "bruno",
      createdDaysAgo: 18,
      dueInDays: 4,
      steps: [{ to: "IN_PROGRESS", daysAgo: 14, by: "bruno" }],
    },
    {
      asset: "Roteador de borda",
      title: "Comunidade SNMP padrão public no roteador",
      description:
        "O roteador responde a consultas SNMP com a comunidade padrão public, o que permite ler a configuração, as rotas e a lista de interfaces da rede sem autenticação.",
      severity: "MEDIUM",
      remediation:
        "Migrar para SNMPv3 com autenticação e criptografia, remover a comunidade public e limitar quem pode consultar o SNMP por lista de acesso.",
      owaspCategory: "A07:2021",
      cwe: "CWE-1392",
      cve: null,
      reporter: "bruno",
      assignee: "bruno",
      createdDaysAgo: 22,
      dueInDays: 14,
      steps: [],
    },
    {
      asset: "Wi-Fi de visitantes",
      title: "Wi-Fi de visitantes sem isolamento de clientes",
      description:
        "Quem se conecta ao Wi-Fi de visitantes alcança máquinas da rede interna, como o servidor de arquivos, porque falta o isolamento entre clientes e entre VLANs.",
      severity: "HIGH",
      remediation:
        "Separar o Wi-Fi de visitantes em uma VLAN própria, ativar o isolamento de clientes e bloquear no firewall o acesso dessa VLAN à rede interna.",
      owaspCategory: "A05:2021",
      cwe: "CWE-668",
      cve: null,
      reporter: "bruno",
      assignee: "bruno",
      createdDaysAgo: 8,
      dueInDays: 21,
      steps: [],
    },
    {
      asset: "Servidor de arquivos",
      title: "Compartilhamento de rede aberto para o grupo Todos",
      description:
        "A pasta Financeiro estava compartilhada com leitura para o grupo Todos, e qualquer máquina da rede abria os arquivos sem pedir credenciais.",
      severity: "MEDIUM",
      remediation:
        "Remover o grupo Todos, conceder acesso só aos grupos do departamento (menor privilégio) e revisar as permissões dos demais compartilhamentos a cada trimestre.",
      owaspCategory: "A01:2021",
      cwe: "CWE-732",
      cve: null,
      reporter: "bruno",
      assignee: "bruno",
      createdDaysAgo: 27,
      dueInDays: null,
      steps: [
        { to: "IN_PROGRESS", daysAgo: 24, by: "bruno" },
        { to: "FIXED", daysAgo: 9, by: "bruno" },
      ],
    },
    {
      asset: "Roteador de borda",
      title: "Painel web do roteador revela a versão do servidor",
      description:
        "O painel web do roteador informa o fabricante e a versão do servidor no cabeçalho Server (lighttpd 1.4.35), o que ajuda um atacante a escolher quais falhas testar.",
      severity: "INFO",
      remediation:
        "Ocultar ou generalizar o cabeçalho Server e manter o firmware atualizado. Sozinha, essa mudança não corrige falha nenhuma, só reduz a informação exposta.",
      owaspCategory: "A05:2021",
      cwe: "CWE-200",
      cve: null,
      reporter: "bruno",
      assignee: null,
      createdDaysAgo: 6,
      dueInDays: null,
      steps: [],
    },
  ],
}

export const demoProjects: DemoProject[] = [
  portalAluno,
  appSaudeMais,
  redeManaus,
]
