import { join } from "path";
import { fileURLToPath } from "node:url";
import {
  ModuleKind,
  ModuleResolutionKind,
  Project,
  ScriptTarget,
} from "ts-morph";
import { describe, expect, it } from "vitest";
import { generateTsStubs } from "../src/generator/generate";
import { parseSourceFiles, ParseResult } from "../src/parser/parse";
import { arr, date, def, lit, nul, num, obj, p, str, union } from "./dsl";

const FIXTURES = fileURLToPath(new URL("./fixtures", import.meta.url));

/**
 * Интеграционный тест с настоящим пакетом библиотеки описания схем.
 * Механизм одинаков для zod / io-ts / valibot и подобных (алиас из
 * declaration-файла + инференс), поэтому реального пакета достаточно
 * одного — valibot уже есть в devDependencies проекта. Сам механизм
 * покрыт виртуальными кейсами группы G.
 */
describe("библиотека описания схем (настоящий пакет)", () => {
  it("valibot: v.InferOutput<typeof schema>", () => {
    const project = new Project({
      compilerOptions: {
        target: ScriptTarget.ES2020,
        module: ModuleKind.ESNext,
        moduleResolution: ModuleResolutionKind.Bundler,
        strict: true,
      },
    });
    // фикстура внутри репозитория — резолвится реальный node_modules
    const sourceFile = project.addSourceFileAtPath(
      join(FIXTURES, "valibot-input.ts")
    );
    const result: ParseResult = parseSourceFiles([sourceFile], {
      rootDir: FIXTURES,
    });

    expect(result.warnings).toEqual([]);
    expect(result.schema.types).toEqual([
      def(
        "valibot-input",
        "Account",
        true,
        obj(
          p("id", str),
          p("balance", num),
          p("labels", arr(str)),
          p("note", str, true),
          p("status", union(lit("active"), lit("blocked"))),
          p("deletedAt", union(nul, date))
        )
      ),
    ]);

    // сгенерированные стабы обязаны компилироваться рядом с фикстурой
    const { code } = generateTsStubs(result.schema, {
      outputNamespace: "_stubs",
    });
    const stubFile = project.createSourceFile(join(FIXTURES, "_stubs.ts"), code, {
      overwrite: true,
    });
    const diagnostics = stubFile.getPreEmitDiagnostics();
    expect(project.formatDiagnosticsWithColorAndContext(diagnostics)).toBe("");
  });
});
