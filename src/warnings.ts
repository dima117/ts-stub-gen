export type WarningLevel = "off" | "warn" | "error";

export interface Warning<C extends string = string> {
  code: C;
  level: Exclude<WarningLevel, "off">;
  message: string;
  /** Где встретилось: "namespace.Тип.поле". */
  path: string;
}

/**
 * Копилка предупреждений — общий механизм парсера и генератора.
 * Уровень настраивается по коду; "off" подавляет только сообщение —
 * fallback-поведение применяется всегда.
 */
export class WarningReporter<C extends string = string> {
  readonly warnings: Warning<C>[] = [];
  private readonly levels: Record<C, WarningLevel>;

  constructor(
    defaultLevels: Record<C, WarningLevel>,
    overrides?: Partial<Record<C, WarningLevel>>
  ) {
    this.levels = { ...defaultLevels, ...overrides };
  }

  report(code: C, path: string, message: string): void {
    const level = this.levels[code];
    if (level === "off") return;
    this.warnings.push({ code, level, message, path });
  }
}
