import { PropertySig, TypeDefinition, TypeExpr } from "../src/schema";

export const str: TypeExpr = { kind: "string" };
export const num: TypeExpr = { kind: "number" };
export const bool: TypeExpr = { kind: "boolean" };
export const nul: TypeExpr = { kind: "null" };
export const undef: TypeExpr = { kind: "undefined" };
export const unknown: TypeExpr = { kind: "unknown" };
export const date: TypeExpr = { kind: "date" };

export const lit = (value: string | number | boolean): TypeExpr => ({
  kind: "literal",
  value,
});
export const arr = (element: TypeExpr): TypeExpr => ({ kind: "array", element });
export const tuple = (...elements: TypeExpr[]): TypeExpr => ({
  kind: "tuple",
  elements,
});
export const rec = (value: TypeExpr): TypeExpr => ({ kind: "record", value });
export const union = (...variants: TypeExpr[]): TypeExpr => ({
  kind: "union",
  variants,
});
export const obj = (...properties: PropertySig[]): TypeExpr => ({
  kind: "object",
  properties,
});
export const p = (name: string, type: TypeExpr, optional = false): PropertySig => ({
  name,
  optional,
  type,
});
export const ref = (namespace: string, name: string): TypeExpr => ({
  kind: "ref",
  namespace,
  name,
});
export const enumOf = (...members: [string, string | number][]): TypeExpr => ({
  kind: "enum",
  members: members.map(([name, value]) => ({ name, value })),
});
export const def = (
  namespace: string,
  name: string,
  exported: boolean,
  type: TypeExpr
): TypeDefinition => ({ namespace, name, exported, type });
