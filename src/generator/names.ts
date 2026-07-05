import { TypeDefinition } from "../schema";

export const sanitizeNamespace = (namespace: string): string =>
  namespace.replace(/[^A-Za-z0-9_$]/g, "_");

const defKey = (d: TypeDefinition) => `${d.namespace}::${d.name}`;

export interface NameRegistry {
  /** Имя типа в сгенерированном файле (с суффиксом namespace при коллизии). */
  localTypeName(def: TypeDefinition): string;
  helperName(def: TypeDefinition): string;
}

/**
 * Локальное имя = имя типа; если одно имя экспортируется из разных
 * namespace — добавляется суффикс из namespace: Item -> Item_a_item.
 * Имя хелпера = префикс + локальное имя.
 */
export function buildNameRegistry(
  types: TypeDefinition[],
  helperPrefix: string
): NameRegistry {
  const exported = types.filter((d) => d.exported);
  const counts = new Map<string, number>();
  for (const d of exported) {
    counts.set(d.name, (counts.get(d.name) ?? 0) + 1);
  }
  const locals = new Map<string, string>();
  for (const d of exported) {
    const local =
      (counts.get(d.name) ?? 0) > 1
        ? `${d.name}_${sanitizeNamespace(d.namespace)}`
        : d.name;
    locals.set(defKey(d), local);
  }
  return {
    localTypeName: (d) => locals.get(defKey(d)) ?? d.name,
    helperName: (d) => `${helperPrefix}${locals.get(defKey(d)) ?? d.name}`,
  };
}

/** Относительный спецификатор импорта между path-подобными namespace. */
export function relativeModuleSpecifier(
  outputNamespace: string,
  targetNamespace: string
): string {
  const fromParts = outputNamespace.split("/").slice(0, -1);
  const toParts = targetNamespace.split("/");
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length - 1 &&
    fromParts[common] === toParts[common]
  ) {
    common++;
  }
  const up = fromParts.length - common;
  const specifier = [...Array<string>(up).fill(".."), ...toParts.slice(common)].join("/");
  return specifier.startsWith(".") ? specifier : `./${specifier}`;
}
