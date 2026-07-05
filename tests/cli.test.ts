import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/cli/config";
import {
  BIN_NAME,
  DEFAULT_CONFIG_FILENAME,
  VERSION,
} from "../src/cli/constants";
import { main } from "../src/cli/index";
import { runStubGen } from "../src/cli/run";

const dirs: string[] = [];
const makeDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-stub-gen-cli-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop()!, { recursive: true, force: true });
  }
});

const writeConfig = (dir: string, config: unknown) => {
  const path = join(dir, DEFAULT_CONFIG_FILENAME);
  writeFileSync(path, JSON.stringify(config));
  return path;
};

describe("CLI: аргументы и режимы", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const captureLog = () => vi.spyOn(console, "log").mockImplementation(() => {});
  const captureInfo = () =>
    vi.spyOn(console, "info").mockImplementation(() => {});
  const captureError = () =>
    vi.spyOn(console, "error").mockImplementation(() => {});

  it("--version и -v выводят версию", () => {
    const info = captureInfo();
    expect(main(["--version"])).toBe(0);
    expect(main(["-v"])).toBe(0);
    expect(info.mock.calls.flat().join("\n")).toContain(VERSION);
  });

  it("--help и -h выводят справку, сгенерированную из объявлений", () => {
    const info = captureInfo();
    expect(main(["--help"])).toBe(0);
    expect(main(["-h"])).toBe(0);
    const out = info.mock.calls.flat().join("\n");
    expect(out).toContain(BIN_NAME);
    expect(out).toContain("--version");
    expect(out).toContain(DEFAULT_CONFIG_FILENAME);
  });

  it("без аргументов берётся конфиг по соглашению из текущей папки", () => {
    const dir = makeDir();
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    const err = captureError();
    expect(main([])).toBe(1); // конфига в папке нет
    expect(err.mock.calls.flat().join("\n")).toContain(DEFAULT_CONFIG_FILENAME);
  });

  it("один аргумент — путь к конфигу, полный прогон", () => {
    const dir = makeDir();
    writeFileSync(join(dir, "input.ts"), `export interface User { id: string; }`);
    const configPath = writeConfig(dir, {
      source: { type: "typescript", entry: ["input.ts"] },
      output: { file: "stubs.ts" },
    });
    captureLog();
    expect(main([configPath])).toBe(0);
    expect(existsSync(join(dir, "stubs.ts"))).toBe(true);
  });

  it("два аргумента — ошибка и код 1", () => {
    const err = captureError();
    expect(main(["a.json", "b.json"])).toBe(1);
    expect(err.mock.calls.flat().join("\n")).toMatch(/b\.json/);
  });

  it("неизвестный флаг — ошибка и код 1", () => {
    const err = captureError();
    expect(main(["--nope"])).toBe(1);
    expect(err.mock.calls.flat().join("\n")).toContain("--nope");
  });
});

describe("CLI: конфиг", () => {
  it("отсутствующий конфиг — понятная ошибка с подсказкой", () => {
    expect(() => loadConfig(join(makeDir(), DEFAULT_CONFIG_FILENAME))).toThrow(
      /конфиг не найден/
    );
  });
  it("битый JSON — ошибка", () => {
    const dir = makeDir();
    const path = join(dir, DEFAULT_CONFIG_FILENAME);
    writeFileSync(path, "{ oops");
    expect(() => loadConfig(path)).toThrow(/некорректный JSON/);
  });
  it("неподдерживаемый source.type — ошибка", () => {
    const path = writeConfig(makeDir(), {
      source: { type: "swagger", entry: ["a.ts"] },
      output: { file: "out.ts" },
    });
    expect(() => loadConfig(path)).toThrow(/поддерживается только: "typescript"/);
  });
  it("пустой entry — ошибка", () => {
    const path = writeConfig(makeDir(), {
      source: { type: "typescript", entry: [] },
      output: { file: "out.ts" },
    });
    expect(() => loadConfig(path)).toThrow(/source\.entry/);
  });
  it("нет output.file — ошибка", () => {
    const path = writeConfig(makeDir(), {
      source: { type: "typescript", entry: ["a.ts"] },
      output: {},
    });
    expect(() => loadConfig(path)).toThrow(/output\.file/);
  });
  it("опечатка в имени поля — ошибка с путём до неизвестного поля", () => {
    const path = writeConfig(makeDir(), {
      source: { type: "typescript", entry: ["a.ts"] },
      output: { files: "out.ts" },
    });
    expect(() => loadConfig(path)).toThrow(/output\.files/);
  });
  it("неизвестный код предупреждения — ошибка", () => {
    const path = writeConfig(makeDir(), {
      source: { type: "typescript", entry: ["a.ts"] },
      output: { file: "out.ts" },
      warnings: { "no-such-code": "warn" },
    });
    expect(() => loadConfig(path)).toThrow(/no-such-code.*неизвестный код предупреждения/);
  });
  it("некорректный уровень — ошибка", () => {
    const path = writeConfig(makeDir(), {
      source: { type: "typescript", entry: ["a.ts"] },
      output: { file: "out.ts" },
      warnings: { "date-type": "loud" },
    });
    expect(() => loadConfig(path)).toThrow(/off \| warn \| error/);
  });
  it("некорректный селектор в values — ошибка", () => {
    const path = writeConfig(makeDir(), {
      source: { type: "typescript", entry: ["a.ts"] },
      output: { file: "out.ts", values: { "a.b.c": "x" } },
    });
    expect(() => loadConfig(path)).toThrow(/Тип, Тип\.поле или \*\.поле/);
  });
  it("некорректная форма правила в values — ошибка", () => {
    const path = writeConfig(makeDir(), {
      source: { type: "typescript", entry: ["a.ts"] },
      output: { file: "out.ts", values: { "*.id": { nope: 1 } } },
    });
    expect(() => loadConfig(path)).toThrow(/строкой-выражением/);
  });
  it("отсутствующий setupFile — понятная ошибка", () => {
    const path = writeConfig(makeDir(), {
      source: { type: "typescript", entry: ["a.ts"] },
      output: { file: "out.ts", setupFile: "nope.ts" },
    });
    expect(() => loadConfig(path)).toThrow(/setupFile.*не найден/);
  });
  it("уровни раскладываются по кодам парсера и генератора, пути резолвятся", () => {
    const dir = makeDir();
    const path = writeConfig(dir, {
      source: { type: "typescript", entry: "models/*.ts", rootDir: "." },
      output: { file: "testing/stubs.ts" },
      warnings: { "date-type": "warn", "inline-cycle": "error" },
    });
    const config = loadConfig(path);
    expect(config.parserWarningLevels).toEqual({ "date-type": "warn" });
    expect(config.generatorWarningLevels).toEqual({ "inline-cycle": "error" });
    expect(config.outputNamespace).toBe("testing/stubs");
    expect(config.entry).toHaveLength(1);
    expect(config.entry[0].endsWith("models/*.ts")).toBe(true);
  });
});

describe("CLI: запуск", () => {
  it("генерирует файл по конфигу с правильными относительными импортами", () => {
    const dir = makeDir();
    mkdirSync(join(dir, "models"));
    writeFileSync(
      join(dir, "models", "user.ts"),
      `export interface User { id: string; age: number; }`
    );
    const configPath = writeConfig(dir, {
      source: { type: "typescript", entry: ["models/*.ts"] },
      output: { file: "testing/stubs.ts" },
    });

    const result = runStubGen(loadConfig(configPath));

    expect(result.written).toBe(true);
    expect(result.hasErrors).toBe(false);
    expect(result.typesCount).toBe(1);
    const content = readFileSync(join(dir, "testing", "stubs.ts"), "utf8");
    expect(content).toContain(`import type { User } from "../models/user";`);
    expect(content).toContain(
      "export function GetStubUser(overrides: Partial<User> = {}): User {"
    );
  });

  it("setupFile вклеивается в сгенерированный файл, values применяются", () => {
    const dir = makeDir();
    writeFileSync(
      join(dir, "input.ts"),
      `export interface Account { id: string; }`
    );
    writeFileSync(
      join(dir, "stub-setup.ts"),
      `let n = 0;\nconst nextId = (): string => \`id-\${++n}\`;\n`
    );
    const configPath = writeConfig(dir, {
      source: { type: "typescript", entry: ["input.ts"] },
      output: {
        file: "testing/stubs.ts",
        setupFile: "stub-setup.ts",
        values: { "*.id": "nextId()" },
      },
    });

    runStubGen(loadConfig(configPath));

    const stubs = readFileSync(join(dir, "testing", "stubs.ts"), "utf8");
    expect(stubs).toContain(
      "// --- начало setup-файла (stub-setup.ts); правьте исходный файл ---"
    );
    expect(stubs).toContain("const nextId = (): string =>");
    expect(stubs).toContain("// --- конец setup-файла ---");
    expect(stubs).toContain("id: (nextId()),");
  });

  it("учитывает helperPrefix", () => {
    const dir = makeDir();
    writeFileSync(join(dir, "input.ts"), `export interface User { id: string; }`);
    const configPath = writeConfig(dir, {
      source: { type: "typescript", entry: ["input.ts"] },
      output: { file: "stubs.ts", helperPrefix: "makeStub" },
    });

    runStubGen(loadConfig(configPath));

    const content = readFileSync(join(dir, "stubs.ts"), "utf8");
    expect(content).toContain("export function makeStubUser");
  });

  it("предупреждение уровня error прерывает запись", () => {
    const dir = makeDir();
    writeFileSync(
      join(dir, "input.ts"),
      `export interface WithDate { created: Date; }`
    );
    const configPath = writeConfig(dir, {
      source: { type: "typescript", entry: ["input.ts"] },
      output: { file: "stubs.ts" },
      warnings: { "date-type": "error" },
    });

    const result = runStubGen(loadConfig(configPath));

    expect(result.hasErrors).toBe(true);
    expect(result.written).toBe(false);
    expect(existsSync(join(dir, "stubs.ts"))).toBe(false);
    expect(result.warnings.map((w) => `${w.level}:${w.code}`)).toEqual([
      "error:date-type",
    ]);
  });

  it("entry без единого файла — понятная ошибка", () => {
    const dir = makeDir();
    const configPath = writeConfig(dir, {
      source: { type: "typescript", entry: ["nope/*.ts"] },
      output: { file: "stubs.ts" },
    });
    expect(() => runStubGen(loadConfig(configPath))).toThrow(
      /не найдено ни одного файла/
    );
  });
});
