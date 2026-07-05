import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { ModuleKind, Project, ScriptTarget } from "ts-morph";
import { generateTsStubs } from "../generator/generate";
import { parseSourceFiles } from "../parser/parse";
import { Warning } from "../warnings";
import { ConfigError, ResolvedConfig } from "./config";

export interface RunResult {
  outputFile: string;
  typesCount: number;
  warnings: Warning[];
  /** Есть ли предупреждения уровня error (файл при этом не записывается). */
  hasErrors: boolean;
  written: boolean;
}

export function runStubGen(config: ResolvedConfig): RunResult {
  const project = config.tsconfig
    ? new Project({
        tsConfigFilePath: config.tsconfig,
        skipAddingFilesFromTsConfig: true,
      })
    : new Project({
        compilerOptions: {
          target: ScriptTarget.ES2020,
          module: ModuleKind.CommonJS,
          strict: true,
        },
      });

  const rootFiles = project.addSourceFilesAtPaths(config.entry);
  if (rootFiles.length === 0) {
    throw new ConfigError(
      `по путям source.entry не найдено ни одного файла: ${config.entry.join(", ")}`
    );
  }

  const { schema, warnings: parseWarnings } = parseSourceFiles(rootFiles, {
    rootDir: config.rootDir,
    warningLevels: config.parserWarningLevels,
  });
  const setupCode =
    config.setupFile !== undefined
      ? readFileSync(config.setupFile, "utf8")
      : undefined;
  const { code, warnings: generatorWarnings } = generateTsStubs(schema, {
    outputNamespace: config.outputNamespace,
    helperPrefix: config.helperPrefix,
    values: config.values,
    setupCode,
    setupLabel: config.setupLabel,
    warningLevels: config.generatorWarningLevels,
  });

  const warnings: Warning[] = [...parseWarnings, ...generatorWarnings];
  const hasErrors = warnings.some((w) => w.level === "error");

  let written = false;
  if (!hasErrors) {
    mkdirSync(dirname(config.outputFile), { recursive: true });
    writeFileSync(config.outputFile, code);
    written = true;
  }

  return {
    outputFile: config.outputFile,
    typesCount: schema.types.length,
    warnings,
    hasErrors,
    written,
  };
}
