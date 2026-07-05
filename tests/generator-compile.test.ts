import { describe, expect, it } from "vitest";
import { generateTsStubs } from "../src/generator/generate";
import { createVirtualProject, parseSourceFiles } from "../src/parser/parse";
import { SchemaTestCase } from "./types";
import { cases as primitives } from "./cases/a-primitives";
import { cases as structures } from "./cases/b-structures";
import { cases as named } from "./cases/c-named";
import { cases as modules } from "./cases/d-modules";
import { cases as computed } from "./cases/e-computed";
import { cases as diagnostics } from "./cases/f-diagnostics";
import { cases as inference } from "./cases/g-inference";

const groups: Array<[string, SchemaTestCase[]]> = [
  ["A. примитивы и литералы", primitives],
  ["B. структуры", structures],
  ["C. именованные типы и ссылки", named],
  ["D. файлы и импорты", modules],
  ["E. вычисляемые типы", computed],
  ["F. диагностика", diagnostics],
  ["G. инференс из библиотек схем", inference],
];

// Свойство: код, сгенерированный по схеме любого кейса парсера, обязан
// компилироваться без ошибок рядом с исходными файлами этого кейса.
for (const [groupName, cases] of groups) {
  describe(`сгенерированный код компилируется: ${groupName}`, () => {
    for (const testCase of cases) {
      it(testCase.name, () => {
        const project = createVirtualProject(testCase.files);
        const roots = (testCase.rootFiles ?? Object.keys(testCase.files)).map(
          (path) => project.getSourceFileOrThrow(path)
        );
        const { schema } = parseSourceFiles(roots, testCase.options);
        const { code, warnings } = generateTsStubs(schema, {
          outputNamespace: "_stubs",
        });
        expect(warnings).toEqual([]);

        const stubFile = project.createSourceFile("/_stubs.ts", code);
        const diagnosticsList = stubFile.getPreEmitDiagnostics();
        expect(project.formatDiagnosticsWithColorAndContext(diagnosticsList)).toBe("");
      });
    }
  });
}
