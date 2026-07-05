# Быстрый старт

## Установка

Установите пакет как dev-зависимость:

```sh
npm install -D ts-stub-gen
```

## Конфиг

Создайте файл `ts-stub-gen.config.json` в корне проекта. Все пути в конфиге указываются относительно самого файла конфига:

```json
{
  "source": {
    "type": "typescript",
    "entry": ["src/models/*.ts"]
  },
  "output": {
    "file": "src/testing/stubs.ts"
  }
}
```

## Генерация

Запустите генерацию:

```sh
npx ts-stub-gen
```

Если конфиг лежит не в корне проекта, передайте путь к нему аргументом: `npx ts-stub-gen configs/stubs.json`.

Для каждого экспортированного типа из `entry` в выходном файле появится функция-хелпер. Например, из такого типа:

```ts
// src/models/account.ts
export interface Account {
  id: string;
  balance: number;
  tags: string[];
  blocked: boolean;
}
```

получится такой хелпер:

```ts
// src/testing/stubs.ts (генерируется, не редактируйте)
import type { Account } from "../models/account";

export function GetStubAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "",
    balance: 0,
    tags: [],
    blocked: false,
    ...overrides,
  };
}
```

## Использование в тесте

Вызывайте хелпер в тесте и передавайте в `overrides` только те поля, которые тест проверяет. Для вложенных типов подставляйте результат их собственных хелперов:

```ts
import { GetStubAccount, GetStubResponse } from "../testing/stubs";

it("показывает баланс счёта", () => {
  const response = GetStubResponse({
    account: GetStubAccount({ balance: 100 }),
  });
  // ...
});
```

Добавьте команду генерации в скрипты проекта и запускайте её после изменения типов:

```json
{ "scripts": { "gen:stubs": "ts-stub-gen" } }
```

Сгенерированный файл компилируется вместе с тестами, поэтому, если стабы разойдутся с типами, TypeScript сообщит об этом при сборке.

Следующий шаг — задать осмысленные значения для отдельных полей: об этом рассказывает раздел [«Кастомные значения»](/guide/values).
