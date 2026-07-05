# Рецепты

Рецепты на этой странице используют механизм кастомных значений. Если вы с ним ещё не знакомы, начните со страницы [«Кастомные значения»](/guide/values) — там описаны селекторы, выражения и подключение setup-файла.

## Инкрементальные id

Счётчик в setup-файле выдаёт каждому стабу новый идентификатор, поэтому объекты в тесте не совпадают друг с другом случайно:

```ts
// src/testing/stub-setup.ts
let nextIdCounter = 0;
const nextId = (): string => `id-${++nextIdCounter}`;
```

```json
{
  "output": {
    "file": "src/testing/stubs.ts",
    "setupFile": "src/testing/stub-setup.ts",
    "values": { "*.id": "nextId()" }
  }
}
```

В результате каждый вызов хелпера получает свежий id:

```ts
export function GetStubAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: (nextId()),
    balance: 0,
    ...overrides,
  };
}
```

## Реалистичные данные через faker

Генераторы фейковых данных подключаются так же — импортом в setup-файле. Установите пакет:

```sh
npm install -D @faker-js/faker
```

Задайте в setup-файле seed, чтобы данные были воспроизводимы от запуска к запуску:

```ts
// src/testing/stub-setup.ts
import { faker } from "@faker-js/faker";

faker.seed(1);
```

Теперь любые генераторы faker доступны в выражениях:

```json
{
  "output": {
    "file": "src/testing/stubs.ts",
    "setupFile": "src/testing/stub-setup.ts",
    "values": {
      "*.phone": "faker.phone.number()",
      "*.email": "faker.internet.email()",
      "User.name": "faker.person.fullName()"
    }
  }
}
```

## Значение для типа целиком

Селектор без точки задаёт значение по умолчанию для типа. Это удобно для алиасов примитивов: везде, где встречается `PhoneNumber`, стаб получит валидный номер, а не пустую строку:

```ts
export type PhoneNumber = string;
export interface Account { id: string; phone: PhoneNumber; }
```

```json
{ "output": { "values": { "PhoneNumber": "'+7 900 000-00-00'" } } }
```

Значение попадает в хелпер типа, а через него — во все стабы, где тип используется:

```ts
export function GetStubAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "",
    phone: GetStubPhoneNumber(),
    ...overrides,
  };
}

export function GetStubPhoneNumber(override?: PhoneNumber): PhoneNumber {
  return override !== undefined ? override : ('+7 900 000-00-00');
}
```
