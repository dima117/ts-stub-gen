import { SchemaTestCase } from "../types";
import { arr, bool, def, lit, num, obj, p, ref, str, union } from "../dsl";

export const cases: SchemaTestCase[] = [
  {
    name: "алиас на ReturnType локальной функции разворачивается",
    files: {
      "/main.ts": `
        function makeUser() {
          return { id: "", age: 0, active: true };
        }
        export type User = ReturnType<typeof makeUser>;`,
    },
    expectedTypes: [
      def(
        "main",
        "User",
        true,
        obj(p("id", str), p("age", num), p("active", bool))
      ),
    ],
  },
  {
    name: "ReturnType с именованным типом результата даёт ссылку",
    files: {
      "/main.ts": `
        export interface Account { id: string; }
        declare function load(): Account;
        export type LoadResult = ReturnType<typeof load>;`,
    },
    expectedTypes: [
      def("main", "Account", true, obj(p("id", str))),
      def("main", "LoadResult", true, ref("main", "Account")),
    ],
  },
  {
    name: "утилитарные алиасы lib вне «белого списка»: NonNullable, Exclude",
    files: {
      "/main.ts": `
        export interface X {
          a: NonNullable<string | null>;
          b: Exclude<'one' | 'two' | 'three', 'two'>;
        }`,
    },
    expectedTypes: [
      def(
        "main",
        "X",
        true,
        obj(p("a", str), p("b", union(lit("one"), lit("three"))))
      ),
    ],
  },
  {
    name: "библиотека описания схем: инференс через алиас из node_modules",
    rootFiles: ["/main.ts"],
    files: {
      "/node_modules/schemalib/package.json": `{
        "name": "schemalib",
        "version": "1.0.0",
        "types": "index.d.ts"
      }`,
      "/node_modules/schemalib/index.d.ts": `
        export interface Schema<T> { readonly _output: T; }
        export declare function object<T extends Record<string, Schema<any>>>(
          shape: T
        ): Schema<{ [K in keyof T]: T[K]["_output"] }>;
        export declare function string(): Schema<string>;
        export declare function number(): Schema<number>;
        export declare function array<T>(item: Schema<T>): Schema<T[]>;
        export type Infer<S extends Schema<any>> = S["_output"];`,
      "/main.ts": `
        import * as s from "schemalib";
        const userSchema = s.object({
          id: s.string(),
          age: s.number(),
          tags: s.array(s.string()),
        });
        export type User = s.Infer<typeof userSchema>;`,
    },
    expectedTypes: [
      def(
        "main",
        "User",
        true,
        obj(p("id", str), p("age", num), p("tags", arr(str)))
      ),
    ],
  },
];
