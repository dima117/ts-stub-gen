/**
 * Правило кастомного значения — TS-выражение. Вставляется в сгенерированный
 * код как есть и вычисляется при каждом вызове хелпера. Может использовать
 * функции из setup-файла (вклеивается в сгенерированный файл) — корректность
 * типов проверяет компилятор при сборке тестов.
 */
export type ValueRule = string;

/** Разложенные по видам селекторов правила из конфига. */
export interface ValueRules {
  /** "Тип.поле" */
  byTypeField: Map<string, ValueRule>;
  /** "*.поле" (ключ — имя поля) */
  byField: Map<string, ValueRule>;
  /** "Тип" */
  byType: Map<string, ValueRule>;
  /** Все исходные селекторы — для поиска неиспользованных. */
  selectors: string[];
}

export function parseValueRules(
  values: Record<string, ValueRule> = {}
): ValueRules {
  const rules: ValueRules = {
    byTypeField: new Map(),
    byField: new Map(),
    byType: new Map(),
    selectors: Object.keys(values),
  };
  for (const [selector, rule] of Object.entries(values)) {
    if (selector.startsWith("*.")) {
      rules.byField.set(selector.slice(2), rule);
    } else if (selector.includes(".")) {
      rules.byTypeField.set(selector, rule);
    } else {
      rules.byType.set(selector, rule);
    }
  }
  return rules;
}
