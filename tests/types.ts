import { TypeDefinition } from "../src/schema";
import { ParserOptions } from "../src/parser/parse";
import { WarningCode } from "../src/parser/warnings";

export interface SchemaTestCase {
  name: string;
  /** Виртуальная файловая структура: путь → содержимое. */
  files: Record<string, string>;
  /** С каких файлов собирать экспортированные типы; по умолчанию — все. */
  rootFiles?: string[];
  options?: ParserOptions;
  /** Ожидаемые определения (порядок не важен — раннер сортирует). */
  expectedTypes: TypeDefinition[];
  /** Ожидаемые коды предупреждений в порядке появления; по умолчанию — ни одного. */
  expectedWarnings?: WarningCode[];
}
