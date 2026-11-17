export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      1,
      "always",
      ["backend", "deps", "ci", "husky", "docker", "docs", "prisma"],
    ],
  },
}