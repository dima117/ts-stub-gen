import { SchemaTestCase } from "../types";
import { arr, bool, def, num, obj, p, rec, ref, str, tuple } from "../dsl";

export const cases: SchemaTestCase[] = [
  {
    name: "вложенный анонимный объект разворачивается инлайн",
    files: {
      "/main.ts": `export interface WithNested { bbb: { name: string; age?: number }; }`,
    },
    expectedTypes: [
      def(
        "main",
        "WithNested",
        true,
        obj(p("bbb", obj(p("name", str), p("age", num, true))))
      ),
    ],
  },
  {
    name: "массивы во всех синтаксисах",
    files: {
      "/main.ts": `
        export interface Account { id: string; }
        export interface Arrays {
          tags: string[];
          accounts: Account[];
          points: { x: number }[];
          generic: Array<number>;
          ro: ReadonlyArray<string>;
          roShort: readonly boolean[];
        }`,
    },
    expectedTypes: [
      def("main", "Account", true, obj(p("id", str))),
      def(
        "main",
        "Arrays",
        true,
        obj(
          p("tags", arr(str)),
          p("accounts", arr(ref("main", "Account"))),
          p("points", arr(obj(p("x", num)))),
          p("generic", arr(num)),
          p("ro", arr(str)),
          p("roShort", arr(bool))
        )
      ),
    ],
  },
  {
    name: "кортеж",
    files: {
      "/main.ts": `export interface Pair { pair: [string, number]; }`,
    },
    expectedTypes: [def("main", "Pair", true, obj(p("pair", tuple(str, num))))],
  },
  {
    name: "индексные сигнатуры и Record",
    files: {
      "/main.ts": `
        export interface Account { id: string; }
        export interface Dict { [key: string]: string; }
        export interface Dicts {
          scores: { [key: string]: number };
          byId: Record<string, Account>;
        }`,
    },
    expectedTypes: [
      def("main", "Account", true, obj(p("id", str))),
      def("main", "Dict", true, rec(str)),
      def(
        "main",
        "Dicts",
        true,
        obj(p("scores", rec(num)), p("byId", rec(ref("main", "Account"))))
      ),
    ],
  },
];
