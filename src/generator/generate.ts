import { StubSchema, TypeDefinition, TypeExpr } from "../schema";
import { WarningLevel } from "../warnings";
import { buildNameRegistry, NameRegistry, relativeModuleSpecifier } from "./names";
import {
  createGeneratorReporter,
  GenerateWarning,
  GeneratorReporter,
  GeneratorWarningCode,
} from "./warnings";

export interface GeneratorOptions {
  /** Namespace выходного файла — от него считаются относительные импорты. */
  outputNamespace: string;
  /** Префикс имён хелперов; по умолчанию GetStub. */
  helperPrefix?: string;
  warningLevels?: Partial<Record<GeneratorWarningCode, WarningLevel>>;
}

export interface GenerateResult {
  code: string;
  warnings: GenerateWarning[];
}

interface GenCtx {
  defs: Map<string, TypeDefinition>;
  registry: NameRegistry;
  reporter: GeneratorReporter;
}

const defKey = (namespace: string, name: string) => `${namespace}::${name}`;

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const propKey = (name: string) => (IDENTIFIER.test(name) ? name : JSON.stringify(name));

/** Генерирует текст TS-файла с хелперами по схеме. */
export function generateTsStubs(
  schema: StubSchema,
  options: GeneratorOptions
): GenerateResult {
  const reporter = createGeneratorReporter(options.warningLevels);
  const registry = buildNameRegistry(schema.types, options.helperPrefix ?? "GetStub");
  const ctx: GenCtx = {
    defs: new Map(schema.types.map((d) => [defKey(d.namespace, d.name), d])),
    registry,
    reporter,
  };

  const exported = schema.types.filter((d) => d.exported);
  const imports = generateImports(exported, registry, options.outputNamespace);
  const functions = exported.map((def) => generateHelper(def, ctx));

  const code =
    functions.length === 0
      ? "export {};\n"
      : [imports.join("\n"), ...functions].filter(Boolean).join("\n\n") + "\n";

  return { code, warnings: reporter.warnings };
}

function generateImports(
  exported: TypeDefinition[],
  registry: NameRegistry,
  outputNamespace: string
): string[] {
  const byNamespace = new Map<string, TypeDefinition[]>();
  for (const def of exported) {
    const list = byNamespace.get(def.namespace) ?? [];
    list.push(def);
    byNamespace.set(def.namespace, list);
  }

  const named = (defs: TypeDefinition[]) =>
    defs
      .map((d) => {
        const local = registry.localTypeName(d);
        return local === d.name ? d.name : `${d.name} as ${local}`;
      })
      .join(", ");

  const lines: string[] = [];
  const namespaces = [...byNamespace.keys()].sort();
  for (const namespace of namespaces) {
    const defs = byNamespace.get(namespace)!;
    const specifier = relativeModuleSpecifier(outputNamespace, namespace);
    // enum нужны в рантайме — обычный импорт; остальное только в типах
    const typeOnly = defs.filter((d) => d.type.kind !== "enum");
    const runtime = defs.filter((d) => d.type.kind === "enum");
    if (typeOnly.length > 0) {
      lines.push(`import type { ${named(typeOnly)} } from "${specifier}";`);
    }
    if (runtime.length > 0) {
      lines.push(`import { ${named(runtime)} } from "${specifier}";`);
    }
  }
  return lines;
}

function generateHelper(def: TypeDefinition, ctx: GenCtx): string {
  const local = ctx.registry.localTypeName(def);
  const fn = ctx.registry.helperName(def);
  const path = `${def.namespace}.${def.name}`;
  const body = def.type;
  const stack = new Set([defKey(def.namespace, def.name)]);

  if (body.kind === "object") {
    const lines: string[] = [];
    for (const prop of body.properties) {
      // optional-поля не заполняем: стаб минимален, и это разрывает
      // рекурсию хелперов при взаимных ссылках через optional-поля
      if (prop.optional) continue;
      lines.push(
        `    ${propKey(prop.name)}: ${defaultExpr(prop.type, ctx, `${path}.${prop.name}`, stack)},`
      );
    }
    lines.push("    ...overrides,");
    return [
      `export function ${fn}(overrides: Partial<${local}> = {}): ${local} {`,
      "  return {",
      ...lines,
      "  };",
      "}",
    ].join("\n");
  }

  if (body.kind === "record") {
    // Partial индексной сигнатуры добавил бы undefined в тип значений
    return [
      `export function ${fn}(overrides: ${local} = {}): ${local} {`,
      "  return { ...overrides };",
      "}",
    ].join("\n");
  }

  // примитивы, union, tuple, enum, date — подмена значения целиком
  const fallback =
    body.kind === "enum"
      ? body.members.length > 0
        ? `${local}.${body.members[0].name}`
        : "undefined as any"
      : defaultExpr(body, ctx, path, stack);
  return [
    `export function ${fn}(override?: ${local}): ${local} {`,
    `  return override !== undefined ? override : ${fallback};`,
    "}",
  ].join("\n");
}

function defaultExpr(
  expr: TypeExpr,
  ctx: GenCtx,
  path: string,
  stack: ReadonlySet<string>
): string {
  switch (expr.kind) {
    case "string":
      return '""';
    case "number":
      return "0";
    case "boolean":
      return "false";
    case "literal":
      return JSON.stringify(expr.value);
    case "null":
      return "null";
    case "undefined":
      return "undefined";
    case "unknown":
      return "undefined as any";
    case "date":
      return "new Date(0)";
    case "array":
      return "[]";
    case "record":
      return "{}";
    case "tuple":
      return `[${expr.elements.map((e) => defaultExpr(e, ctx, path, stack)).join(", ")}]`;
    case "union":
      return expr.variants.length > 0
        ? defaultExpr(expr.variants[0], ctx, path, stack)
        : "undefined as any";
    case "object": {
      const parts = expr.properties
        .filter((p) => !p.optional)
        .map((p) => `${propKey(p.name)}: ${defaultExpr(p.type, ctx, `${path}.${p.name}`, stack)}`);
      return parts.length > 0 ? `{ ${parts.join(", ")} }` : "{}";
    }
    case "enum":
      // тело неэкспортированного enum при инлайн-раскрытии: сам enum
      // импортировать нельзя, подставляем значение первого члена
      return expr.members.length > 0
        ? `${JSON.stringify(expr.members[0].value)} as any`
        : "undefined as any";
    case "ref": {
      const key = defKey(expr.namespace, expr.name);
      const target = ctx.defs.get(key);
      if (!target) {
        ctx.reporter.report(
          "ref-not-found",
          path,
          `в схеме нет типа ${expr.namespace}.${expr.name}`
        );
        return "undefined as any";
      }
      if (target.exported) {
        return `${ctx.registry.helperName(target)}()`;
      }
      if (stack.has(key)) {
        ctx.reporter.report(
          "inline-cycle",
          path,
          `цикл через неэкспортированный тип ${expr.namespace}.${expr.name}`
        );
        return "undefined as any";
      }
      return defaultExpr(target.type, ctx, path, new Set([...stack, key]));
    }
  }
}
