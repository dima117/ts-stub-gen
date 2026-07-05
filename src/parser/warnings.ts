import { Warning, WarningLevel, WarningReporter } from "../warnings";

export type WarningCode =
  /** функция/метод/сигнатура вызова в типе данных; fallback — unknown */
  | "behavior-in-type"
  /** классы, внешние типы (Map, Set, Promise...), прочие конструкции; fallback — unknown */
  | "unsupported-type"
  /** поле типа Date (Date нарушает JSON-сериализуемость данных); fallback — kind "date" */
  | "date-type"
  /** export default; fallback — объявление пропускается / unknown */
  | "default-export"
  /** превышена глубина раскрытия (рекурсивный дженерик и т.п.); fallback — unknown */
  | "expansion-depth";

export const DEFAULT_WARNING_LEVELS: Record<WarningCode, WarningLevel> = {
  "behavior-in-type": "warn",
  "unsupported-type": "warn",
  "date-type": "off",
  "default-export": "warn",
  "expansion-depth": "warn",
};

export type ParseWarning = Warning<WarningCode>;
export type ParserReporter = WarningReporter<WarningCode>;
export type { WarningLevel };

export const createParserReporter = (
  overrides?: Partial<Record<WarningCode, WarningLevel>>
): ParserReporter => new WarningReporter(DEFAULT_WARNING_LEVELS, overrides);
