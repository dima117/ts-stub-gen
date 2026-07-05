import { SourceFile } from "ts-morph";

/**
 * Namespace типа — путь файла без ведущего слэша и расширения.
 * Для реальной файловой системы передаётся rootDir (обычно корень проекта),
 * относительно которого берётся путь.
 */
export const namespaceOf = (sourceFile: SourceFile, rootDir?: string): string => {
  let path: string = sourceFile.getFilePath();
  if (rootDir) {
    const root = rootDir.replace(/\\/g, "/").replace(/\/+$/, "");
    if (path.startsWith(root + "/")) {
      path = path.slice(root.length + 1);
    }
  }
  return path.replace(/^\//, "").replace(/\.(?:d\.ts|tsx?|mts|cts)$/, "");
};
