import { describe, expect, it } from "vitest";
import { compareDefinitions, parseVirtual } from "../src/parser/parse";
import { SchemaTestCase } from "./types";
import { cases as primitives } from "./cases/a-primitives";
import { cases as structures } from "./cases/b-structures";
import { cases as named } from "./cases/c-named";
import { cases as modules } from "./cases/d-modules";
import { cases as computed } from "./cases/e-computed";
import { cases as diagnostics } from "./cases/f-diagnostics";

const groups: Array<[string, SchemaTestCase[]]> = [
  ["A. примитивы и литералы", primitives],
  ["B. структуры", structures],
  ["C. именованные типы и ссылки", named],
  ["D. файлы и импорты", modules],
  ["E. вычисляемые типы", computed],
  ["F. диагностика", diagnostics],
];

for (const [groupName, cases] of groups) {
  describe(groupName, () => {
    for (const testCase of cases) {
      it(testCase.name, () => {
        const { schema, warnings } = parseVirtual(testCase.files, {
          ...testCase.options,
          rootFiles: testCase.rootFiles,
        });
        expect(schema).toEqual({
          version: 1,
          types: [...testCase.expectedTypes].sort(compareDefinitions),
        });
        expect(warnings.map((w) => w.code)).toEqual(testCase.expectedWarnings ?? []);
      });
    }
  });
}
