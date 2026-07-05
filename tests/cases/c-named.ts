import { SchemaTestCase } from "../types";
import { arr, bool, def, enumOf, lit, num, obj, p, ref, str, union } from "../dsl";

export const cases: SchemaTestCase[] = [
  {
    name: "ссылка на экспортированный интерфейс того же файла",
    files: {
      "/main.ts": `
        export interface Account { id: string; }
        export interface Holder { account: Account; }`,
    },
    expectedTypes: [
      def("main", "Account", true, obj(p("id", str))),
      def("main", "Holder", true, obj(p("account", ref("main", "Account")))),
    ],
  },
  {
    name: "неэкспортированный тип попадает в схему с exported: false",
    files: {
      "/main.ts": `
        interface Internal { foo: number; }
        export interface Wrapper { int: Internal; }`,
    },
    expectedTypes: [
      def("main", "Internal", false, obj(p("foo", num))),
      def("main", "Wrapper", true, obj(p("int", ref("main", "Internal")))),
    ],
  },
  {
    name: "алиасы: примитив, union, объект",
    files: {
      "/main.ts": `
        export type UserId = string;
        export type Status = 'active' | 'blocked';
        export type Point = { x: number; y: number };
        export interface User { id: UserId; status: Status; location: Point; }`,
    },
    expectedTypes: [
      def("main", "Point", true, obj(p("x", num), p("y", num))),
      def("main", "Status", true, union(lit("active"), lit("blocked"))),
      def(
        "main",
        "User",
        true,
        obj(
          p("id", ref("main", "UserId")),
          p("status", ref("main", "Status")),
          p("location", ref("main", "Point"))
        )
      ),
      def("main", "UserId", true, str),
    ],
  },
  {
    name: "enum: числовой и строковый",
    files: {
      "/main.ts": `
        export enum Level { Low, High }
        export enum Color { Red = 'red', Blue = 'blue' }
        export interface Item { level: Level; color: Color; }`,
    },
    expectedTypes: [
      def("main", "Color", true, enumOf(["Red", "red"], ["Blue", "blue"])),
      def(
        "main",
        "Item",
        true,
        obj(p("level", ref("main", "Level")), p("color", ref("main", "Color")))
      ),
      def("main", "Level", true, enumOf(["Low", 0], ["High", 1])),
    ],
  },
  {
    name: "рекурсивный тип замыкается через ссылку",
    files: {
      "/main.ts": `export interface Tree { value: string; children: Tree[]; }`,
    },
    expectedTypes: [
      def(
        "main",
        "Tree",
        true,
        obj(p("value", str), p("children", arr(ref("main", "Tree"))))
      ),
    ],
  },
  {
    name: "взаимная рекурсия между файлами",
    files: {
      "/a.ts": `
        import { B } from './b';
        export interface A { b: B; }`,
      "/b.ts": `
        import { A } from './a';
        export interface B { a?: A; }`,
    },
    expectedTypes: [
      def("a", "A", true, obj(p("b", ref("b", "B")))),
      def("b", "B", true, obj(p("a", ref("a", "A"), true))),
    ],
  },
  {
    name: "extends: поля базового интерфейса вливаются, своё поле переопределяет",
    files: {
      "/main.ts": `
        export interface Base { id: string; common: number; }
        export interface Derived extends Base { common: 42; extra: boolean; }`,
    },
    expectedTypes: [
      def("main", "Base", true, obj(p("id", str), p("common", num))),
      def(
        "main",
        "Derived",
        true,
        obj(p("id", str), p("common", lit(42)), p("extra", bool))
      ),
    ],
  },
];
