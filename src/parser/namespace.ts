import { SourceFile } from "ts-morph";

/** Namespace типа — путь файла без ведущего слэша и расширения. */
export const namespaceOf = (sourceFile: SourceFile): string =>
  sourceFile
    .getFilePath()
    .replace(/^\//, "")
    .replace(/\.(?:d\.ts|tsx?|mts|cts)$/, "");
