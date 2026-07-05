import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "ru-RU",
  title: "ts-stub-gen",
  description: "Стабы данных для тестов из типов TypeScript",
  // на GitHub Pages сайт живёт по адресу /<имя-репозитория>/ —
  // base подставляет CI (см. .github/workflows/docs.yml)
  base: process.env.DOCS_BASE ?? "/",
  // внутренние документы репозитория — не для сайта
  srcExclude: ["DESIGN.md"],
  themeConfig: {
    nav: [
      { text: "Быстрый старт", link: "/guide/quick-start" },
      { text: "Конфиг", link: "/guide/config" },
      { text: "Рецепты", link: "/guide/recipes" },
    ],
    sidebar: [
      {
        text: "Руководство",
        items: [
          { text: "Быстрый старт", link: "/guide/quick-start" },
          { text: "Кастомные значения", link: "/guide/values" },
          { text: "Рецепты", link: "/guide/recipes" },
          { text: "Формат конфига", link: "/guide/config" },
        ],
      },
    ],
    outline: { label: "На этой странице" },
    docFooter: { prev: "Назад", next: "Дальше" },
  },
});
