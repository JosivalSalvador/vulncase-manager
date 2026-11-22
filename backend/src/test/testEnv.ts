import "dotenv/config"

// Banco do serviço "db-test" do compose.yaml. A CI troca por outro banco
// usando a variável TEST_DATABASE_URL.
const DEFAULT_TEST_DATABASE_URL =
  "mysql://test:test@localhost:3307/vulncase_test"

// Banco 15 do Redis do compose, longe das sessões de desenvolvimento (banco 0).
const DEFAULT_TEST_REDIS_URL = "redis://localhost:6379/15"

// Os testes criam e apagam dados. Esta trava impede que rodem, por engano, no
// banco de desenvolvimento.
export function getTestDatabaseUrl(): string {
  const url: string =
    process.env["TEST_DATABASE_URL"] ?? DEFAULT_TEST_DATABASE_URL
  const databaseName: string = new URL(url).pathname.slice(1)

  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Recuso rodar os testes de integração no banco "${databaseName}": o ` +
        'nome do banco de testes precisa conter "test".',
    )
  }

  return url
}

export function getTestRedisUrl(): string {
  return process.env["TEST_REDIS_URL"] ?? DEFAULT_TEST_REDIS_URL
}
