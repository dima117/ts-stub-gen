import { SchemaTestCase } from "../types";
import { def, num, obj, p, ref, str } from "../dsl";

export const cases: SchemaTestCase[] = [
  {
    name: "импорт типа из другого файла",
    files: {
      "/models/account.ts": `export interface Account { id: string; }`,
      "/main.ts": `
        import { Account } from './models/account';
        export interface Response { account: Account; }`,
    },
    expectedTypes: [
      def("main", "Response", true, obj(p("account", ref("models/account", "Account")))),
      def("models/account", "Account", true, obj(p("id", str))),
    ],
  },
  {
    name: "одинаковые имена интерфейсов в разных файлах различаются по namespace",
    files: {
      "/a/item.ts": `export interface Item { x: number; }`,
      "/b/item.ts": `export interface Item { y: string; }`,
      "/main.ts": `
        import { Item as ItemA } from './a/item';
        import { Item as ItemB } from './b/item';
        export interface Pair { a: ItemA; b: ItemB; }`,
    },
    expectedTypes: [
      def("a/item", "Item", true, obj(p("x", num))),
      def("b/item", "Item", true, obj(p("y", str))),
      def(
        "main",
        "Pair",
        true,
        obj(p("a", ref("a/item", "Item")), p("b", ref("b/item", "Item")))
      ),
    ],
  },
  {
    name: "import type работает как обычный импорт",
    files: {
      "/models/account.ts": `export interface Account { id: string; }`,
      "/main.ts": `
        import type { Account } from './models/account';
        export interface Response { account: Account; }`,
    },
    expectedTypes: [
      def("main", "Response", true, obj(p("account", ref("models/account", "Account")))),
      def("models/account", "Account", true, obj(p("id", str))),
    ],
  },
  {
    name: "переименованный импорт ссылается на оригинальное имя",
    files: {
      "/models/account.ts": `export interface Account { id: string; }`,
      "/main.ts": `
        import { Account as Acc } from './models/account';
        export interface R { a: Acc; }`,
    },
    expectedTypes: [
      def("main", "R", true, obj(p("a", ref("models/account", "Account")))),
      def("models/account", "Account", true, obj(p("id", str))),
    ],
  },
  {
    name: "реэкспорт резолвится к файлу исходного объявления",
    files: {
      "/origin.ts": `export interface X { v: number; }`,
      "/hub.ts": `export * from './origin';`,
      "/main.ts": `
        import { X } from './hub';
        export interface Y { x: X; }`,
    },
    expectedTypes: [
      def("main", "Y", true, obj(p("x", ref("origin", "X")))),
      def("origin", "X", true, obj(p("v", num))),
    ],
  },
];
