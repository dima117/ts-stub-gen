import { builtinModules } from "node:module";
import { basename, dirname } from "node:path";
import { defineConfig } from "vite";
import { bin } from "./package.json";

// путь артефакта задаётся полем bin в package.json — сборка следует за ним
const binPath = Object.values(bin)[0];

export default defineConfig({
  build: {
    target: "node18",
    outDir: dirname(binPath),
    minify: false,
    lib: {
      entry: "src/cli/bin.ts",
      formats: ["cjs"],
      fileName: () => basename(binPath),
    },
    rollupOptions: {
      // ts-morph — рантайм-зависимость пакета, в бандл не включаем
      external: [
        "ts-morph",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        banner: "#!/usr/bin/env node",
      },
    },
  },
});
