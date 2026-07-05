import { Warning, WarningLevel, WarningReporter } from "../warnings";

export type GeneratorWarningCode =
  /** ссылка на тип, которого нет в схеме; fallback — undefined as any */
  | "ref-not-found"
  /** цикл через неэкспортированные типы при инлайн-раскрытии; fallback — undefined as any */
  | "inline-cycle"
  /** селектор из values не применился ни разу (вероятно, опечатка) */
  | "value-unused";

export const DEFAULT_GENERATOR_WARNING_LEVELS: Record<
  GeneratorWarningCode,
  WarningLevel
> = {
  "ref-not-found": "warn",
  "inline-cycle": "warn",
  "value-unused": "warn",
};

export type GenerateWarning = Warning<GeneratorWarningCode>;
export type GeneratorReporter = WarningReporter<GeneratorWarningCode>;

export const createGeneratorReporter = (
  overrides?: Partial<Record<GeneratorWarningCode, WarningLevel>>
): GeneratorReporter =>
  new WarningReporter(DEFAULT_GENERATOR_WARNING_LEVELS, overrides);
