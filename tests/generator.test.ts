import { describe, expect, it } from "vitest";
import ts from "typescript";
import { generateTsStubs } from "../src/generator/generate";
import { createVirtualProject, parseVirtual } from "../src/parser/parse";
import { StubSchema, TypeDefinition } from "../src/schema";
import { arr, bool, date, def, enumOf, num, obj, p, ref, str } from "./dsl";

const schemaOf = (...types: TypeDefinition[]): StubSchema => ({ version: 1, types });

describe("генератор: текст хелперов", () => {
  it("объектный хелпер: дефолты, optional пропущен, overrides в конце", () => {
    const schema = schemaOf(
      def(
        "main",
        "Account",
        true,
        obj(p("id", str), p("flags", arr(bool)), p("note", str, true))
      )
    );
    const { code, warnings } = generateTsStubs(schema, { outputNamespace: "_stubs" });
    expect(warnings).toEqual([]);
    expect(code).toBe(`import type { Account } from "./main";

export function GetStubAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "",
    flags: [],
    ...overrides,
  };
}
`);
  });

  it("неэкспортированный тип раскрывается инлайн", () => {
    const schema = schemaOf(
      def("main", "Internal", false, obj(p("foo", num))),
      def("main", "Wrapper", true, obj(p("int", ref("main", "Internal"))))
    );
    const { code, warnings } = generateTsStubs(schema, { outputNamespace: "_stubs" });
    expect(warnings).toEqual([]);
    expect(code).toBe(`import type { Wrapper } from "./main";

export function GetStubWrapper(overrides: Partial<Wrapper> = {}): Wrapper {
  return {
    int: { foo: 0 },
    ...overrides,
  };
}
`);
  });

  it("коллизия имён из разных namespace: суффиксы и алиасы импортов", () => {
    const schema = schemaOf(
      def("a/item", "Item", true, obj(p("x", num))),
      def("b/item", "Item", true, obj(p("y", str))),
      def(
        "main",
        "Pair",
        true,
        obj(p("a", ref("a/item", "Item")), p("b", ref("b/item", "Item")))
      )
    );
    const { code, warnings } = generateTsStubs(schema, { outputNamespace: "_stubs" });
    expect(warnings).toEqual([]);
    expect(code).toBe(`import type { Item as Item_a_item } from "./a/item";
import type { Item as Item_b_item } from "./b/item";
import type { Pair } from "./main";

export function GetStubItem_a_item(overrides: Partial<Item_a_item> = {}): Item_a_item {
  return {
    x: 0,
    ...overrides,
  };
}

export function GetStubItem_b_item(overrides: Partial<Item_b_item> = {}): Item_b_item {
  return {
    y: "",
    ...overrides,
  };
}

export function GetStubPair(overrides: Partial<Pair> = {}): Pair {
  return {
    a: GetStubItem_a_item(),
    b: GetStubItem_b_item(),
    ...overrides,
  };
}
`);
  });

  it("enum и алиас примитива получают хелперы с подменой целиком", () => {
    const schema = schemaOf(
      def("main", "Color", true, enumOf(["Red", "red"], ["Blue", "blue"])),
      def(
        "main",
        "User",
        true,
        obj(p("id", ref("main", "UserId")), p("color", ref("main", "Color")))
      ),
      def("main", "UserId", true, str)
    );
    const { code, warnings } = generateTsStubs(schema, { outputNamespace: "_stubs" });
    expect(warnings).toEqual([]);
    expect(code).toBe(`import type { User, UserId } from "./main";
import { Color } from "./main";

export function GetStubColor(override?: Color): Color {
  return override !== undefined ? override : Color.Red;
}

export function GetStubUser(overrides: Partial<User> = {}): User {
  return {
    id: GetStubUserId(),
    color: GetStubColor(),
    ...overrides,
  };
}

export function GetStubUserId(override?: UserId): UserId {
  return override !== undefined ? override : "";
}
`);
  });

  it("пустая схема даёт пустой модуль", () => {
    const { code, warnings } = generateTsStubs(schemaOf(), { outputNamespace: "_stubs" });
    expect(warnings).toEqual([]);
    expect(code).toBe("export {};\n");
  });
});

describe("генератор: кастомные значения", () => {
  it("выражения по селекторам; setup вклеивается после импортов; optional с правилом заполняется", () => {
    const schema = schemaOf(
      def(
        "main",
        "Account",
        true,
        obj(p("id", str), p("phone", str, true), p("when", date))
      )
    );
    const { code, warnings } = generateTsStubs(schema, {
      outputNamespace: "_stubs",
      setupCode: "let n = 0;\nconst nextId = (): string => `id-${++n}`;\n",
      setupLabel: "stub-setup.ts",
      values: {
        "*.id": "nextId()",
        "Account.phone": "'+7 900 000-00-00'",
        "*.when": "new Date(2020, 0, 1)",
      },
    });
    expect(warnings).toEqual([]);
    expect(code).toBe(`import type { Account } from "./main";

// --- начало setup-файла (stub-setup.ts); правьте исходный файл ---
let n = 0;
const nextId = (): string => \`id-\${++n}\`;
// --- конец setup-файла ---

export function GetStubAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: (nextId()),
    phone: ('+7 900 000-00-00'),
    when: (new Date(2020, 0, 1)),
    ...overrides,
  };
}
`);
  });

  it("приоритет: Тип.поле выше *.поле", () => {
    const schema = schemaOf(
      def("main", "Account", true, obj(p("id", str))),
      def("main", "User", true, obj(p("id", str)))
    );
    const { code, warnings } = generateTsStubs(schema, {
      outputNamespace: "_stubs",
      values: { "Account.id": "'acc-id'", "*.id": "'common-id'" },
    });
    expect(warnings).toEqual([]);
    expect(code).toContain(`id: ('acc-id')`);
    expect(code).toContain(`id: ('common-id')`);
  });

  it("селектор типа: хелпер алиаса, инлайн-раскрытие и объектный тип целиком", () => {
    const schema = schemaOf(
      def("main", "Account", true, obj(p("id", str))),
      def("main", "Internal", false, str),
      def("main", "PhoneNumber", true, str),
      def(
        "main",
        "Wrapper",
        true,
        obj(p("phone", ref("main", "PhoneNumber")), p("int", ref("main", "Internal")))
      )
    );
    const { code, warnings } = generateTsStubs(schema, {
      outputNamespace: "_stubs",
      values: {
        PhoneNumber: "'+7 111'",
        Internal: "'inlined'",
        Account: "makeAccount()",
      },
    });
    expect(warnings).toEqual([]);
    expect(code).toContain(`override !== undefined ? override : ('+7 111')`);
    expect(code).toContain(`int: ('inlined')`);
    expect(code).toContain(`return { ...(makeAccount()), ...overrides };`);
  });

  it("неиспользованный селектор: предупреждение value-unused", () => {
    const schema = schemaOf(def("main", "Account", true, obj(p("id", str))));
    const { warnings } = generateTsStubs(schema, {
      outputNamespace: "_stubs",
      values: { "*.nope": "'x'" },
    });
    expect(warnings.map((w) => `${w.code}:${w.path}`)).toEqual([
      "value-unused:*.nope",
    ]);
  });

  it("корректные выражения компилируются, ошибка типа в выражении ломает сборку", () => {
    const files = {
      "/main.ts": `export interface Account { id: string; phone: string; }`,
    };
    const { schema } = parseVirtual(files);
    const good = generateTsStubs(schema, {
      outputNamespace: "_stubs",
      setupCode: "const nextId = (): string => 'id-1';",
      values: { "*.id": "nextId()", "Account.phone": "'+7 900 000-00-00'" },
    });
    const project = createVirtualProject(files);
    const goodFile = project.createSourceFile("/_stubs.ts", good.code);
    expect(
      project.formatDiagnosticsWithColorAndContext(goodFile.getPreEmitDiagnostics())
    ).toBe("");

    // выражение неверного типа — TS ловит это при сборке тестов
    const bad = generateTsStubs(schema, {
      outputNamespace: "_stubs",
      setupCode: "const wrongId = (): number => 0;",
      values: { "*.id": "wrongId()" },
    });
    const badProject = createVirtualProject(files);
    const badFile = badProject.createSourceFile("/_stubs.ts", bad.code);
    expect(badFile.getPreEmitDiagnostics().length).toBeGreaterThan(0);
  });

  it("рантайм: выражения из setup вычисляются при каждом вызове", () => {
    const files = {
      "/main.ts": `export interface Account { id: string; phone: string; }`,
    };
    const { schema } = parseVirtual(files);
    const { code } = generateTsStubs(schema, {
      outputNamespace: "_stubs",
      setupCode: "let n = 0;\nconst nextId = (): string => `id-${++n}`;",
      values: { "*.id": "nextId()", "Account.phone": "'+7 900 000-00-00'" },
    });

    const js = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText;
    const mod = { exports: {} as any };
    new Function("exports", "require", "module", js)(
      mod.exports,
      () => {
        throw new Error("в сгенерированном коде не должно быть рантайм-импортов");
      },
      mod
    );
    const { GetStubAccount } = mod.exports;

    expect(GetStubAccount()).toEqual({ id: "id-1", phone: "+7 900 000-00-00" });
    expect(GetStubAccount().id).toBe("id-2"); // вычисляется при каждом вызове
    expect(GetStubAccount({ id: "custom" }).id).toBe("custom");
  });
});

describe("генератор: рантайм", () => {
  it("дефолты и плоский merge overrides работают", () => {
    const files = {
      "/models/account.ts": `export interface Account { id: string; balance: number; }`,
      "/main.ts": `
        import { Account } from './models/account';
        export interface Response {
          total: number;
          account: Account;
          tags: string[];
          nested: { flag: boolean };
          opt?: string;
        }`,
    };
    const { schema } = parseVirtual(files);
    const { code } = generateTsStubs(schema, { outputNamespace: "_stubs" });

    const js = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText;
    const mod = { exports: {} as any };
    new Function("exports", "require", "module", js)(
      mod.exports,
      () => {
        throw new Error("в сгенерированном коде не должно быть рантайм-импортов");
      },
      mod
    );
    const { GetStubAccount, GetStubResponse } = mod.exports;

    expect(GetStubResponse()).toEqual({
      total: 0,
      account: { id: "", balance: 0 },
      tags: [],
      nested: { flag: false },
    });
    expect("opt" in GetStubResponse()).toBe(false);

    const stub = GetStubResponse({
      total: 42,
      account: GetStubAccount({ id: "acc-1" }),
      opt: "x",
    });
    expect(stub).toEqual({
      total: 42,
      account: { id: "acc-1", balance: 0 },
      tags: [],
      nested: { flag: false },
      opt: "x",
    });
  });
});
