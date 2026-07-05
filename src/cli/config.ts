import { existsSync, readFileSync } from "fs";
import { dirname, relative, resolve } from "path";
import * as v from "valibot";
import {
  DEFAULT_GENERATOR_WARNING_LEVELS,
  GeneratorWarningCode,
} from "../generator/warnings";
import { DEFAULT_WARNING_LEVELS, WarningCode } from "../parser/warnings";
import { WARNING_LEVELS, WarningLevel } from "../warnings";
import { DEFAULT_CONFIG_FILENAME } from "./constants";

/** Ошибка конфигурации/запуска — CLI показывает её сообщение без стектрейса. */
export class ConfigError extends Error {}

/** Поддерживаемые типы источников схемы. */
export const SOURCE_TYPES = ["typescript"] as const;

const PARSER_CODES = Object.keys(DEFAULT_WARNING_LEVELS);
const GENERATOR_CODES = Object.keys(DEFAULT_GENERATOR_WARNING_LEVELS);
const KNOWN_WARNING_CODES = [...PARSER_CODES, ...GENERATOR_CODES];
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Схема конфига — единственный источник правды: тип CliConfig выводится
 * из неё, валидация (включая неизвестные поля) выполняется по ней же.
 */
const ConfigSchema = v.strictObject({
  source: v.strictObject({
    type: v.picklist(
      SOURCE_TYPES,
      `пока поддерживается только: ${SOURCE_TYPES.map((t) => `"${t}"`).join(", ")}`
    ),
    entry: v.union(
      [
        v.pipe(v.string(), v.nonEmpty()),
        v.pipe(v.array(v.string()), v.minLength(1)),
      ],
      "ожидается строка или непустой массив строк (пути/глобы)"
    ),
    rootDir: v.optional(v.string("ожидается строка")),
    tsconfig: v.optional(v.string("ожидается строка")),
  }),
  output: v.strictObject({
    file: v.pipe(
      v.string("ожидается путь к генерируемому файлу"),
      v.nonEmpty("ожидается путь к генерируемому файлу")
    ),
    helperPrefix: v.optional(
      v.pipe(
        v.string(),
        v.regex(IDENTIFIER, "ожидается корректный префикс идентификатора")
      )
    ),
  }),
  warnings: v.optional(
    v.record(
      v.picklist(
        KNOWN_WARNING_CODES,
        `неизвестный код предупреждения; известные: ${KNOWN_WARNING_CODES.join(", ")}`
      ),
      v.picklist(
        WARNING_LEVELS,
        `уровень должен быть одним из ${WARNING_LEVELS.join(" | ")}`
      )
    )
  ),
});

export type CliConfig = v.InferOutput<typeof ConfigSchema>;

/** Разобранный конфиг: все пути абсолютные, настройки с применёнными fallback. */
export interface ResolvedConfig {
  sourceType: (typeof SOURCE_TYPES)[number];
  /** Пути/глобы входных файлов. */
  entry: string[];
  tsconfig?: string;
  /** Корень для вычисления namespace типов. */
  rootDir: string;
  outputFile: string;
  /** Namespace выходного файла относительно rootDir (для импортов). */
  outputNamespace: string;
  helperPrefix?: string;
  parserWarningLevels: Partial<Record<WarningCode, WarningLevel>>;
  generatorWarningLevels: Partial<Record<GeneratorWarningCode, WarningLevel>>;
}

const formatIssues = (issues: v.BaseIssue<unknown>[]): string =>
  issues
    .map((issue) => {
      const dotPath = v.getDotPath(issue);
      return dotPath ? `${dotPath}: ${issue.message}` : issue.message;
    })
    .join("; ");

export function loadConfig(configPath: string): ResolvedConfig {
  if (!existsSync(configPath)) {
    throw new ConfigError(
      `конфиг не найден: ${configPath}. Укажите путь аргументом или создайте ` +
        `${DEFAULT_CONFIG_FILENAME} рядом`
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (e) {
    throw new ConfigError(
      `конфиг ${configPath} — некорректный JSON: ${(e as Error).message}`
    );
  }

  const parsed = v.safeParse(ConfigSchema, raw);
  if (!parsed.success) {
    throw new ConfigError(
      `конфиг ${configPath} не прошёл валидацию: ${formatIssues(parsed.issues)}`
    );
  }
  const config = parsed.output;

  const parserWarningLevels: Partial<Record<WarningCode, WarningLevel>> = {};
  const generatorWarningLevels: Partial<
    Record<GeneratorWarningCode, WarningLevel>
  > = {};
  for (const [code, level] of Object.entries(config.warnings ?? {})) {
    if (PARSER_CODES.includes(code)) {
      parserWarningLevels[code as WarningCode] = level;
    } else {
      generatorWarningLevels[code as GeneratorWarningCode] = level;
    }
  }

  const base = dirname(configPath);
  const rootDir = resolve(base, config.source.rootDir ?? ".");
  const tsconfig =
    config.source.tsconfig !== undefined
      ? resolve(base, config.source.tsconfig)
      : undefined;
  if (tsconfig && !existsSync(tsconfig)) {
    throw new ConfigError(`source.tsconfig: файл не найден: ${tsconfig}`);
  }
  const outputFile = resolve(base, config.output.file);
  const outputNamespace = relative(rootDir, outputFile)
    .replace(/\\/g, "/")
    .replace(/\.(?:d\.ts|tsx?|mts|cts)$/, "");
  const entryList =
    typeof config.source.entry === "string"
      ? [config.source.entry]
      : config.source.entry;

  return {
    sourceType: config.source.type,
    entry: entryList.map((e) => resolve(base, e).replace(/\\/g, "/")),
    tsconfig,
    rootDir,
    outputFile,
    outputNamespace,
    helperPrefix: config.output.helperPrefix,
    parserWarningLevels,
    generatorWarningLevels,
  };
}
