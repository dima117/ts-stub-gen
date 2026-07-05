import { SchemaTestCase } from "../types";
import { arr, bool, def, num, obj, p, ref, str } from "../dsl";

export const cases: SchemaTestCase[] = [
  {
    name: "инстанцирование дженерика раскрывается структурно",
    files: {
      "/main.ts": `
        export interface Account { id: string; }
        export interface Paginated<T> { items: T[]; total: number; }
        export interface AccountPage { page: Paginated<Account>; }`,
    },
    // Paginated — открытый дженерик, в схему не попадает
    expectedTypes: [
      def("main", "Account", true, obj(p("id", str))),
      def(
        "main",
        "AccountPage",
        true,
        obj(p("page", obj(p("items", arr(ref("main", "Account"))), p("total", num))))
      ),
    ],
  },
  {
    name: "утилитарные типы Partial / Pick / Omit раскрываются",
    files: {
      "/main.ts": `
        export interface Settings { a: string; b: number; c?: boolean; }
        export interface Forms {
          partial: Partial<Settings>;
          pick: Pick<Settings, 'a'>;
          omit: Omit<Settings, 'a'>;
        }`,
    },
    expectedTypes: [
      def(
        "main",
        "Forms",
        true,
        obj(
          p("partial", obj(p("a", str, true), p("b", num, true), p("c", bool, true))),
          p("pick", obj(p("a", str))),
          p("omit", obj(p("b", num), p("c", bool, true)))
        )
      ),
      def(
        "main",
        "Settings",
        true,
        obj(p("a", str), p("b", num), p("c", bool, true))
      ),
    ],
  },
  {
    name: "пересечение типов раскрывается в объединённый объект",
    files: {
      "/main.ts": `
        export interface Left { l: string; }
        export interface Right { r: number; }
        export interface Both { both: Left & Right; }`,
    },
    expectedTypes: [
      def("main", "Both", true, obj(p("both", obj(p("l", str), p("r", num))))),
      def("main", "Left", true, obj(p("l", str))),
      def("main", "Right", true, obj(p("r", num))),
    ],
  },
  {
    name: "mapped type раскрывается в объект",
    files: {
      "/main.ts": `export interface Flags { flags: { [K in 'read' | 'write']: boolean }; }`,
    },
    expectedTypes: [
      def("main", "Flags", true, obj(p("flags", obj(p("read", bool), p("write", bool))))),
    ],
  },
  {
    name: "indexed access и алиас на инстанцированный дженерик",
    files: {
      "/main.ts": `
        export interface Settings { a: string; b: number; }
        export interface Paginated<T> { items: T[]; total: number; }
        export type SettingsList = Paginated<Settings>;
        export interface Usage { field: Settings['a']; }`,
    },
    expectedTypes: [
      def("main", "Settings", true, obj(p("a", str), p("b", num))),
      def(
        "main",
        "SettingsList",
        true,
        obj(p("items", arr(ref("main", "Settings"))), p("total", num))
      ),
      def("main", "Usage", true, obj(p("field", str))),
    ],
  },
];
