import {
  ModuleKind,
  Node,
  Project,
  ScriptTarget,
  SourceFile,
} from "ts-morph";
import { StubSchema, TypeDefinition } from "../schema";
import { buildDefinitionBody, ConvertContext, NamedDeclaration } from "./convert";
import { namespaceOf } from "./namespace";
import {
  createParserReporter,
  ParseWarning,
  WarningCode,
  WarningLevel,
} from "./warnings";

export interface ParserOptions {
  warningLevels?: Partial<Record<WarningCode, WarningLevel>>;
  /** Корень проекта: namespace берётся как путь файла относительно него. */
  rootDir?: string;
}

export interface ParseResult {
  schema: StubSchema;
  warnings: ParseWarning[];
}

/**
 * Строит схему по исходным файлам.
 * В схему попадают все экспортированные именованные объявления корневых файлов
 * плюс — транзитивно — все объявления, на которые есть ссылки (в любых файлах,
 * в том числе неэкспортированные: у них exported: false).
 */
export function parseSourceFiles(
  rootFiles: SourceFile[],
  options: ParserOptions = {}
): ParseResult {
  const reporter = createParserReporter(options.warningLevels);
  const toNamespace = (sourceFile: SourceFile) =>
    namespaceOf(sourceFile, options.rootDir);
  const queue: NamedDeclaration[] = [];
  const visited = new Set<string>();

  const enqueue = (decl: NamedDeclaration) => {
    const namespace = toNamespace(decl.getSourceFile());
    const name = decl.getName();
    const key = `${namespace}::${name}`;
    if (!visited.has(key)) {
      visited.add(key);
      queue.push(decl);
    }
    return { namespace, name };
  };

  const ctx: ConvertContext = { reporter, namespaceOf: toNamespace, enqueue };

  for (const sourceFile of rootFiles) {
    const declarations: NamedDeclaration[] = [
      ...sourceFile.getInterfaces(),
      ...sourceFile.getTypeAliases(),
      ...sourceFile.getEnums(),
    ];
    for (const decl of declarations) {
      if (decl.isDefaultExport()) {
        reporter.report(
          "default-export",
          `${toNamespace(sourceFile)}.${decl.getName()}`,
          `default-экспорт пока не поддерживается: ${decl.getName()}`
        );
        continue;
      }
      if (!decl.isExported()) continue;
      // открытый дженерик не может стать определением — схема монофорфна;
      // его инстанцирования раскрываются по месту использования
      if (!Node.isEnumDeclaration(decl) && decl.getTypeParameters().length > 0) {
        continue;
      }
      enqueue(decl);
    }
  }

  const definitions: TypeDefinition[] = [];
  while (queue.length > 0) {
    const decl = queue.shift()!;
    definitions.push({
      namespace: toNamespace(decl.getSourceFile()),
      name: decl.getName(),
      exported: decl.isExported() && !decl.isDefaultExport(),
      type: buildDefinitionBody(decl, ctx),
    });
  }

  definitions.sort(compareDefinitions);

  return {
    schema: { version: 1, types: definitions },
    warnings: reporter.warnings,
  };
}

export function compareDefinitions(a: TypeDefinition, b: TypeDefinition): number {
  if (a.namespace !== b.namespace) return a.namespace < b.namespace ? -1 : 1;
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return 0;
}

/** Проект во встроенной in-memory файловой системе (для тестов). */
export function createVirtualProject(files: Record<string, string>): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: ScriptTarget.ES2020,
      module: ModuleKind.CommonJS,
      strict: true,
    },
  });
  for (const [path, content] of Object.entries(files)) {
    if (/\.(?:d\.ts|tsx?|mts|cts)$/.test(path)) {
      project.createSourceFile(path, content);
    } else {
      // package.json и прочие не-TS файлы: только в ФС, не в программу
      project.getFileSystem().writeFileSync(path, content);
    }
  }
  return project;
}

/**
 * Парсинг виртуальной файловой структуры (для тестов): пути + содержимое.
 * Импорты между виртуальными файлами резолвятся компилятором.
 */
export function parseVirtual(
  files: Record<string, string>,
  options: ParserOptions & { rootFiles?: string[] } = {}
): ParseResult {
  const project = createVirtualProject(files);
  const roots = (options.rootFiles ?? Object.keys(files)).map((path) =>
    project.getSourceFileOrThrow(path)
  );
  return parseSourceFiles(roots, options);
}
