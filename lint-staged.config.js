const quote = (files) => files.map((file) => `"${file}"`).join(" ")

export default {
  "backend/src/**/*.{ts,mts,cts,js,mjs,cjs}": (files) => [
    `npm --prefix backend exec -- eslint --fix --no-warn-ignored ${quote(files)}`,
    `npm --prefix backend exec -- prettier --write ${quote(files)}`,
  ],
  "backend/src/**/*.{json,md,yml,yaml}": (files) => [
    `npm --prefix backend exec -- prettier --write ${quote(files)}`,
  ],
}