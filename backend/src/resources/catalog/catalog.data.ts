export type OwaspEdition = "2021" | "2025"

export interface OwaspEntry {
  code: string
  edition: OwaspEdition
  // Nome oficial, em inglês, como está em owasp.org/Top10.
  name: string
  // Tradução para exibição (a edição 2025 ainda não tem tradução oficial).
  namePt: string
}

export interface CweEntry {
  code: string
  // Título oficial do CWE (MITRE), em inglês.
  name: string
}

export const owaspCatalog: OwaspEntry[] = [
  {
    code: "A01:2021",
    edition: "2021",
    name: "Broken Access Control",
    namePt: "Quebra de Controle de Acesso",
  },
  {
    code: "A02:2021",
    edition: "2021",
    name: "Cryptographic Failures",
    namePt: "Falhas Criptográficas",
  },
  { code: "A03:2021", edition: "2021", name: "Injection", namePt: "Injeção" },
  {
    code: "A04:2021",
    edition: "2021",
    name: "Insecure Design",
    namePt: "Design Inseguro",
  },
  {
    code: "A05:2021",
    edition: "2021",
    name: "Security Misconfiguration",
    namePt: "Configuração Incorreta de Segurança",
  },
  {
    code: "A06:2021",
    edition: "2021",
    name: "Vulnerable and Outdated Components",
    namePt: "Componentes Vulneráveis e Desatualizados",
  },
  {
    code: "A07:2021",
    edition: "2021",
    name: "Identification and Authentication Failures",
    namePt: "Falhas de Identificação e Autenticação",
  },
  {
    code: "A08:2021",
    edition: "2021",
    name: "Software and Data Integrity Failures",
    namePt: "Falhas na Integridade de Software e Dados",
  },
  {
    code: "A09:2021",
    edition: "2021",
    name: "Security Logging and Monitoring Failures",
    namePt: "Falhas de Registro e Monitoramento de Segurança",
  },
  {
    code: "A10:2021",
    edition: "2021",
    name: "Server-Side Request Forgery (SSRF)",
    namePt: "Falsificação de Requisição do Lado do Servidor (SSRF)",
  },
  {
    code: "A01:2025",
    edition: "2025",
    name: "Broken Access Control",
    namePt: "Quebra de Controle de Acesso",
  },
  {
    code: "A02:2025",
    edition: "2025",
    name: "Security Misconfiguration",
    namePt: "Configuração Incorreta de Segurança",
  },
  {
    code: "A03:2025",
    edition: "2025",
    name: "Software Supply Chain Failures",
    namePt: "Falhas na Cadeia de Suprimentos de Software",
  },
  {
    code: "A04:2025",
    edition: "2025",
    name: "Cryptographic Failures",
    namePt: "Falhas Criptográficas",
  },
  { code: "A05:2025", edition: "2025", name: "Injection", namePt: "Injeção" },
  {
    code: "A06:2025",
    edition: "2025",
    name: "Insecure Design",
    namePt: "Design Inseguro",
  },
  {
    code: "A07:2025",
    edition: "2025",
    name: "Authentication Failures",
    namePt: "Falhas de Autenticação",
  },
  {
    code: "A08:2025",
    edition: "2025",
    name: "Software or Data Integrity Failures",
    namePt: "Falhas na Integridade de Software ou Dados",
  },
  {
    code: "A09:2025",
    edition: "2025",
    name: "Security Logging and Alerting Failures",
    namePt: "Falhas de Registro e Alerta de Segurança",
  },
  {
    code: "A10:2025",
    edition: "2025",
    name: "Mishandling of Exceptional Conditions",
    namePt: "Tratamento Inadequado de Condições Excepcionais",
  },
]

// Os CWEs mais comuns em aplicações web, APIs e código em geral. A lista do
// MITRE tem centenas de itens: este catálogo é uma SUGESTÃO para o formulário,
// e o campo do achado aceita qualquer CWE no formato "CWE-<número>".
export const cweCatalog: CweEntry[] = [
  { code: "CWE-16", name: "Configuration" },
  { code: "CWE-20", name: "Improper Input Validation" },
  {
    code: "CWE-22",
    name: "Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')",
  },
  {
    code: "CWE-77",
    name: "Improper Neutralization of Special Elements used in a Command ('Command Injection')",
  },
  {
    code: "CWE-78",
    name: "Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')",
  },
  {
    code: "CWE-79",
    name: "Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')",
  },
  {
    code: "CWE-89",
    name: "Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')",
  },
  {
    code: "CWE-94",
    name: "Improper Control of Generation of Code ('Code Injection')",
  },
  { code: "CWE-117", name: "Improper Output Neutralization for Logs" },
  {
    code: "CWE-119",
    name: "Improper Restriction of Operations within the Bounds of a Memory Buffer",
  },
  { code: "CWE-125", name: "Out-of-bounds Read" },
  { code: "CWE-190", name: "Integer Overflow or Wraparound" },
  {
    code: "CWE-200",
    name: "Exposure of Sensitive Information to an Unauthorized Actor",
  },
  {
    code: "CWE-209",
    name: "Generation of Error Message Containing Sensitive Information",
  },
  { code: "CWE-250", name: "Execution with Unnecessary Privileges" },
  { code: "CWE-259", name: "Use of Hard-coded Password" },
  { code: "CWE-269", name: "Improper Privilege Management" },
  { code: "CWE-276", name: "Incorrect Default Permissions" },
  { code: "CWE-284", name: "Improper Access Control" },
  { code: "CWE-287", name: "Improper Authentication" },
  { code: "CWE-295", name: "Improper Certificate Validation" },
  { code: "CWE-306", name: "Missing Authentication for Critical Function" },
  {
    code: "CWE-307",
    name: "Improper Restriction of Excessive Authentication Attempts",
  },
  { code: "CWE-311", name: "Missing Encryption of Sensitive Data" },
  { code: "CWE-312", name: "Cleartext Storage of Sensitive Information" },
  { code: "CWE-319", name: "Cleartext Transmission of Sensitive Information" },
  { code: "CWE-326", name: "Inadequate Encryption Strength" },
  { code: "CWE-327", name: "Use of a Broken or Risky Cryptographic Algorithm" },
  { code: "CWE-330", name: "Use of Insufficiently Random Values" },
  { code: "CWE-345", name: "Insufficient Verification of Data Authenticity" },
  { code: "CWE-346", name: "Origin Validation Error" },
  { code: "CWE-352", name: "Cross-Site Request Forgery (CSRF)" },
  {
    code: "CWE-362",
    name: "Concurrent Execution using Shared Resource with Improper Synchronization ('Race Condition')",
  },
  { code: "CWE-384", name: "Session Fixation" },
  { code: "CWE-400", name: "Uncontrolled Resource Consumption" },
  { code: "CWE-416", name: "Use After Free" },
  { code: "CWE-434", name: "Unrestricted Upload of File with Dangerous Type" },
  { code: "CWE-476", name: "NULL Pointer Dereference" },
  { code: "CWE-494", name: "Download of Code Without Integrity Check" },
  { code: "CWE-502", name: "Deserialization of Untrusted Data" },
  { code: "CWE-521", name: "Weak Password Requirements" },
  { code: "CWE-532", name: "Insertion of Sensitive Information into Log File" },
  {
    code: "CWE-601",
    name: "URL Redirection to Untrusted Site ('Open Redirect')",
  },
  {
    code: "CWE-611",
    name: "Improper Restriction of XML External Entity Reference",
  },
  { code: "CWE-613", name: "Insufficient Session Expiration" },
  {
    code: "CWE-614",
    name: "Sensitive Cookie in HTTPS Session Without 'Secure' Attribute",
  },
  { code: "CWE-639", name: "Authorization Bypass Through User-Controlled Key" },
  {
    code: "CWE-640",
    name: "Weak Password Recovery Mechanism for Forgotten Password",
  },
  { code: "CWE-668", name: "Exposure of Resource to Wrong Sphere" },
  {
    code: "CWE-732",
    name: "Incorrect Permission Assignment for Critical Resource",
  },
  {
    code: "CWE-770",
    name: "Allocation of Resources Without Limits or Throttling",
  },
  { code: "CWE-778", name: "Insufficient Logging" },
  { code: "CWE-787", name: "Out-of-bounds Write" },
  { code: "CWE-798", name: "Use of Hard-coded Credentials" },
  { code: "CWE-862", name: "Missing Authorization" },
  { code: "CWE-863", name: "Incorrect Authorization" },
  {
    code: "CWE-916",
    name: "Use of Password Hash With Insufficient Computational Effort",
  },
  { code: "CWE-918", name: "Server-Side Request Forgery (SSRF)" },
  {
    code: "CWE-942",
    name: "Permissive Cross-domain Policy with Untrusted Domains",
  },
  { code: "CWE-1004", name: "Sensitive Cookie Without 'HttpOnly' Flag" },
  {
    code: "CWE-1021",
    name: "Improper Restriction of Rendered UI Layers or Frames",
  },
  { code: "CWE-1104", name: "Use of Unmaintained Third Party Components" },
  {
    code: "CWE-1275",
    name: "Sensitive Cookie with Improper SameSite Attribute",
  },
  {
    code: "CWE-1321",
    name: "Improperly Controlled Modification of Object Prototype Attributes ('Prototype Pollution')",
  },
  { code: "CWE-1333", name: "Inefficient Regular Expression Complexity" },
]

// Lista de códigos aceitos no campo owaspCategory do achado.
export const owaspCodes = owaspCatalog.map((entry) => entry.code) as [
  string,
  ...string[],
]
