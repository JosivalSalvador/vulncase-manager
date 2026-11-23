export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      1,
      "always",
      [
        "backend",
        "frontend",
        "deps",
        "ci",
        "husky",
        "docker",
        "docs",
        "prisma",
      ],
    ],
  },
}