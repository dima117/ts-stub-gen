# TODO

Дизайн и принятые решения: [docs/DESIGN.md](docs/DESIGN.md).

## Генератор
- namespace-квалификация селекторов values при коллизиях имён типов ("models/account:Account.id")
- политика заполнения optional-полей (отложено до реальных запросов пользователей; заполнение отдельного поля уже доступно через values)
- защита от бесконечной рекурсии хелперов при обязательном рекурсивном поле (next: LinkedList)

## Парсер
- export default interface/type — сейчас предупреждение default-export, поддержать позже
- квалифицированные имена и TS namespace (A.B.C)
- bigint, template literal types
- const enum: ссылка в сгенерированном коде может не работать при isolatedModules

## Инфраструктура
- альтернативные источники схемы: swagger / GraphQL (source.type в конфиге CLI уже заложен)
- публикация npm-пакета ts-stub-gen (имя проверено — свободно; сборка, bin, README готовы)
- включить GitHub Pages в настройках репозитория (Settings → Pages → Source: GitHub Actions) — workflow публикации уже настроен
