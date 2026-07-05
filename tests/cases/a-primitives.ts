import { SchemaTestCase } from "../types";
import { def, lit, nul, num, obj, p, str, bool, undef, union, unknown } from "../dsl";

export const cases: SchemaTestCase[] = [
  {
    name: "примитивы string / number / boolean",
    files: {
      "/main.ts": `export interface Primitives { s: string; n: number; b: boolean; }`,
    },
    expectedTypes: [
      def("main", "Primitives", true, obj(p("s", str), p("n", num), p("b", bool))),
    ],
  },
  {
    name: "литеральные типы",
    files: {
      "/main.ts": `export interface Literals { s: 'test'; n: 1234; neg: -1; f: false; t: true; }`,
    },
    expectedTypes: [
      def(
        "main",
        "Literals",
        true,
        obj(
          p("s", lit("test")),
          p("n", lit(1234)),
          p("neg", lit(-1)),
          p("f", lit(false)),
          p("t", lit(true))
        )
      ),
    ],
  },
  {
    name: "null и undefined как типы полей",
    files: {
      "/main.ts": `export interface Nullish { n: null; u: undefined; }`,
    },
    expectedTypes: [def("main", "Nullish", true, obj(p("n", nul), p("u", undef)))],
  },
  {
    name: "any и unknown дают unknown",
    files: {
      "/main.ts": `export interface Loose { a: any; u: unknown; }`,
    },
    expectedTypes: [def("main", "Loose", true, obj(p("a", unknown), p("u", unknown)))],
  },
  {
    name: "union литералов сохраняет порядок исходника",
    files: {
      "/main.ts": `export interface WithUnion { kind: 'one' | 'two' | 'three'; }`,
    },
    expectedTypes: [
      def(
        "main",
        "WithUnion",
        true,
        obj(p("kind", union(lit("one"), lit("two"), lit("three"))))
      ),
    ],
  },
  {
    name: "nullable-поле через union",
    files: {
      "/main.ts": `export interface Nullable { name: string | null; }`,
    },
    expectedTypes: [def("main", "Nullable", true, obj(p("name", union(str, nul))))],
  },
  {
    name: "опциональное поле: optional true, undefined не добавляется",
    files: {
      "/main.ts": `export interface Opt { a?: string; }`,
    },
    expectedTypes: [def("main", "Opt", true, obj(p("a", str, true)))],
  },
  {
    name: "явный undefined в union — поле не optional",
    files: {
      "/main.ts": `export interface Expl { a: string | undefined; }`,
    },
    expectedTypes: [def("main", "Expl", true, obj(p("a", union(str, undef))))],
  },
];
