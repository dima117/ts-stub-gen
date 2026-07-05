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

export type WarningLevel = "off" | "warn" | "error";

export const DEFAULT_WARNING_LEVELS: Record<WarningCode, WarningLevel> = {
  "behavior-in-type": "warn",
  "unsupported-type": "warn",
  "date-type": "off",
  "default-export": "warn",
  "expansion-depth": "warn",
};

export interface ParseWarning {
  code: WarningCode;
  level: Exclude<WarningLevel, "off">;
  message: string;
  /** Где встретилось: "namespace.Тип.поле". */
  path: string;
}

/**
 * Копилка предупреждений. Уровень настраивается по коду; "off" подавляет
 * только сообщение — fallback-поведение применяется всегда.
 */
export class WarningReporter {
  readonly warnings: ParseWarning[] = [];
  private readonly levels: Record<WarningCode, WarningLevel>;

  constructor(overrides?: Partial<Record<WarningCode, WarningLevel>>) {
    this.levels = { ...DEFAULT_WARNING_LEVELS, ...overrides };
  }

  report(code: WarningCode, path: string, message: string): void {
    const level = this.levels[code];
    if (level === "off") return;
    this.warnings.push({ code, level, message, path });
  }
}
