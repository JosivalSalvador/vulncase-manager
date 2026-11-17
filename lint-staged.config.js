const quote = (files) => files.map((file) => `"${file}"`).join(" ")

export default {
  "backend/src/**/*.ts": (files) => [
    `npm --prefix backend exec -- eslint --fix ${quote(files)}`,
    `npm --prefix backend exec -- prettier --write ${quote(files)}`,
  ],
}