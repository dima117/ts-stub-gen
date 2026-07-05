import { writeFileSync } from "fs";
import {
  ModuleKind,
  ModuleResolutionKind,
  Project,
  ScriptTarget,
} from "ts-morph";
import { generateTsStubs } from "./generator/generate";
import { parseSourceFiles } from "./parser/parse";

const INPUT = "_input.ts";
const OUTPUT = "_output.ts";

const project = new Project({
  compilerOptions: {
    target: ScriptTarget.ES2015,
    module: ModuleKind.NodeNext,
    moduleResolution: ModuleResolutionKind.NodeNext,
  },
});
project.addSourceFilesAtPaths(INPUT);

const { schema, warnings } = parseSourceFiles(
  [project.getSourceFileOrThrow(INPUT)],
  { rootDir: process.cwd() }
);
const { code, warnings: generatorWarnings } = generateTsStubs(schema, {
  outputNamespace: OUTPUT.replace(/\.ts$/, ""),
});

for (const w of [...warnings, ...generatorWarnings]) {
  console.warn(`[${w.level}] ${w.code} (${w.path}): ${w.message}`);
}

writeFileSync(OUTPUT, code);
console.log(`${OUTPUT}: типов в схеме — ${schema.types.length}`);
