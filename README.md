# ts-stub-gen

Генерация стаб-хелперов для тестов по типам TypeScript. Для каждого типа создаётся функция, возвращающая корректный объект со значениями по умолчанию; в тесте через `overrides: Partial<T>` задаются только важные для него поля.

```ts
const response = GetStubResponse({
  account: GetStubAccount({ balance: 100 }),
});
```

## Быстрый старт

```sh
npm install -D ts-stub-gen
```

`ts-stub-gen.config.json` в корне проекта:

```json
{
  "source": { "type": "typescript", "entry": ["src/models/*.ts"] },
  "output": { "file": "src/testing/stubs.ts" }
}
```

```sh
npx ts-stub-gen
```

## Возможности

- хелперы компонуются: вложенные типы — через их хелперы;
- кастомные значения полей (`output.values`): выражения и функции из setup-файла — инкрементальные id, faker и т.п.;
- понимает типы из библиотек схем: `z.infer` (zod), `v.InferOutput` (valibot), `t.TypeOf` (io-ts), `ReturnType<typeof fn>`;
- настраиваемые уровни предупреждений (`off | warn | error`).

## Документация

Полная документация лежит в [docs](docs/) и собирается VitePress (`npm run docs:dev` для локального просмотра, публикация на GitHub Pages — автоматически при пуше в master). На главной — обзор возможностей и ограничений, дальше разделы: быстрый старт, кастомные значения, рецепты, формат конфига.
