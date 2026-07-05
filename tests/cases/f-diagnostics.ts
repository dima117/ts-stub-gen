import { SchemaTestCase } from "../types";
import { date, def, obj, p, unknown } from "../dsl";

export const cases: SchemaTestCase[] = [
  {
    name: "функции в типе: unknown + предупреждение behavior-in-type",
    files: {
      "/main.ts": `
        export interface Handlers {
          onClick: () => void;
          run(): number;
        }`,
    },
    expectedTypes: [
      def("main", "Handlers", true, obj(p("onClick", unknown), p("run", unknown))),
    ],
    expectedWarnings: ["behavior-in-type", "behavior-in-type"],
  },
  {
    name: "классы и встроенные контейнеры: unknown + unsupported-type",
    files: {
      "/main.ts": `
        class Model { x = 1; }
        export interface X {
          m: Model;
          map: Map<string, number>;
          s: Set<string>;
          promise: Promise<void>;
        }`,
    },
    expectedTypes: [
      def(
        "main",
        "X",
        true,
        obj(p("m", unknown), p("map", unknown), p("s", unknown), p("promise", unknown))
      ),
    ],
    expectedWarnings: [
      "unsupported-type",
      "unsupported-type",
      "unsupported-type",
      "unsupported-type",
    ],
  },
  {
    name: "Date даёт kind date, предупреждение по умолчанию выключено",
    files: {
      "/main.ts": `export interface WithDate { created: Date; }`,
    },
    expectedTypes: [def("main", "WithDate", true, obj(p("created", date)))],
  },
  {
    name: "Date с включённым предупреждением date-type",
    files: {
      "/main.ts": `export interface WithDate { created: Date; }`,
    },
    options: { warningLevels: { "date-type": "warn" } },
    expectedTypes: [def("main", "WithDate", true, obj(p("created", date)))],
    expectedWarnings: ["date-type"],
  },
  {
    name: "export default пропускается с предупреждением",
    files: {
      "/main.ts": `export default interface Config { debug: boolean; }`,
    },
    expectedTypes: [],
    expectedWarnings: ["default-export"],
  },
];
