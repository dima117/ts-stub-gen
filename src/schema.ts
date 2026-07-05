/**
 * Декларативная схема типов — результат работы парсера и вход генератора.
 * Схема сериализуема в JSON: никаких функций и ссылок на компилятор.
 */

export interface StubSchema {
  version: 1;
  /** Отсортированы по (namespace, name). */
  types: TypeDefinition[];
}

export interface TypeDefinition {
  /**
   * Непрозрачный идентификатор пространства имён.
   * Для TypeScript — путь файла без расширения ("models/user").
   * Пара (namespace, name) уникальна в пределах схемы.
   */
  namespace: string;
  name: string;
  /** Можно ли импортировать тип из сгенерированного кода. */
  exported: boolean;
  type: TypeExpr;
}

export type TypeExpr =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "null" }
  | { kind: "undefined" }
  | { kind: "date" }
  | { kind: "array"; element: TypeExpr }
  | { kind: "tuple"; elements: TypeExpr[] }
  /** Индексная сигнатура или Record<string | number, T>; ключ всегда примитивный. */
  | { kind: "record"; value: TypeExpr }
  | { kind: "object"; properties: PropertySig[] }
  /** Порядок вариантов — как в исходнике; генератор берёт первый. */
  | { kind: "union"; variants: TypeExpr[] }
  /** Встречается только как тело TypeDefinition. */
  | { kind: "enum"; members: EnumMemberDef[] }
  | { kind: "ref"; namespace: string; name: string }
  /** Fallback для any/unknown и неподдержанных конструкций. */
  | { kind: "unknown" };

export interface PropertySig {
  name: string;
  /** `a?: T`; неявный undefined при этом в тип не попадает. */
  optional: boolean;
  type: TypeExpr;
}

export interface EnumMemberDef {
  name: string;
  value: string | number;
}
