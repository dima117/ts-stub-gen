import {
  EnumDeclaration,
  ExpressionWithTypeArguments,
  InterfaceDeclaration,
  LiteralTypeNode,
  Node,
  SourceFile,
  SymbolFlags,
  SyntaxKind,
  Symbol as TsSymbol,
  Type,
  TypeAliasDeclaration,
  TypeLiteralNode,
  TypeNode,
  TypeReferenceNode,
} from "ts-morph";
import { EnumMemberDef, PropertySig, TypeExpr } from "../schema";
import { ParserReporter } from "./warnings";

export type NamedDeclaration =
  | InterfaceDeclaration
  | TypeAliasDeclaration
  | EnumDeclaration;

export interface ConvertContext {
  reporter: ParserReporter;
  /** Namespace файла с учётом rootDir. */
  namespaceOf(sourceFile: SourceFile): string;
  /** Регистрирует именованное объявление в схеме, возвращает его идентификатор. */
  enqueue(decl: NamedDeclaration): { namespace: string; name: string };
}

const MAX_DEPTH = 30;
const UNKNOWN: TypeExpr = { kind: "unknown" };

export function buildDefinitionBody(
  decl: NamedDeclaration,
  ctx: ConvertContext
): TypeExpr {
  const path = `${ctx.namespaceOf(decl.getSourceFile())}.${decl.getName()}`;

  if (Node.isInterfaceDeclaration(decl)) {
    return convertMembers(decl, ctx, path, 0);
  }
  if (Node.isEnumDeclaration(decl)) {
    const members: EnumMemberDef[] = decl
      .getMembers()
      .map((m, i) => ({ name: m.getName(), value: m.getValue() ?? i }));
    return { kind: "enum", members };
  }

  const typeNode = decl.getTypeNode();
  if (!typeNode) {
    ctx.reporter.report("unsupported-type", path, "алиас без типа");
    return UNKNOWN;
  }
  // Символ алиаса передаём как skipAlias: компилятор помечает тип в теле алиаса
  // символом самого алиаса, иначе определение сослалось бы само на себя.
  return convertTypeNode(typeNode, ctx, path, 0, decl.getSymbol());
}

export function convertTypeNode(
  node: TypeNode,
  ctx: ConvertContext,
  path: string,
  depth: number,
  skipAlias?: TsSymbol
): TypeExpr {
  if (depth > MAX_DEPTH) {
    ctx.reporter.report("expansion-depth", path, "превышена глубина разбора типа");
    return UNKNOWN;
  }

  switch (node.getKind()) {
    case SyntaxKind.StringKeyword:
      return { kind: "string" };
    case SyntaxKind.NumberKeyword:
      return { kind: "number" };
    case SyntaxKind.BooleanKeyword:
      return { kind: "boolean" };
    case SyntaxKind.UndefinedKeyword:
      return { kind: "undefined" };
    case SyntaxKind.AnyKeyword:
    case SyntaxKind.UnknownKeyword:
      return UNKNOWN;
    case SyntaxKind.LiteralType:
      return convertLiteral(node.asKindOrThrow(SyntaxKind.LiteralType), ctx, path);
    case SyntaxKind.ParenthesizedType:
      return convertTypeNode(
        node.asKindOrThrow(SyntaxKind.ParenthesizedType).getTypeNode(),
        ctx,
        path,
        depth + 1,
        skipAlias
      );
    case SyntaxKind.ArrayType:
      return {
        kind: "array",
        element: convertTypeNode(
          node.asKindOrThrow(SyntaxKind.ArrayType).getElementTypeNode(),
          ctx,
          path,
          depth + 1
        ),
      };
    case SyntaxKind.TupleType:
      return {
        kind: "tuple",
        elements: node
          .asKindOrThrow(SyntaxKind.TupleType)
          .getElements()
          .map((e) => convertTypeNode(e, ctx, path, depth + 1)),
      };
    case SyntaxKind.UnionType:
      return {
        kind: "union",
        variants: node
          .asKindOrThrow(SyntaxKind.UnionType)
          .getTypeNodes()
          .map((v) => convertTypeNode(v, ctx, path, depth + 1)),
      };
    case SyntaxKind.TypeLiteral:
      return convertMembers(
        node.asKindOrThrow(SyntaxKind.TypeLiteral),
        ctx,
        path,
        depth
      );
    case SyntaxKind.FunctionType:
    case SyntaxKind.ConstructorType:
      ctx.reporter.report("behavior-in-type", path, "функциональный тип в данных");
      return UNKNOWN;
    case SyntaxKind.TypeOperator: {
      const op = node.asKindOrThrow(SyntaxKind.TypeOperator);
      if (op.getOperator() === SyntaxKind.ReadonlyKeyword) {
        return convertTypeNode(op.getTypeNode(), ctx, path, depth + 1);
      }
      // keyof и прочие операторы — раскрываем семантически
      return convertSemantic(node.getType(), node, ctx, path, depth + 1, skipAlias);
    }
    case SyntaxKind.TypeReference:
      return convertTypeReference(
        node.asKindOrThrow(SyntaxKind.TypeReference),
        ctx,
        path,
        depth,
        skipAlias
      );
    case SyntaxKind.IntersectionType:
    case SyntaxKind.MappedType:
    case SyntaxKind.IndexedAccessType:
    case SyntaxKind.ConditionalType:
      // конструкции уровня типов — раскрываем через результат работы компилятора
      return convertSemantic(node.getType(), node, ctx, path, depth + 1, skipAlias);
    default:
      ctx.reporter.report(
        "unsupported-type",
        path,
        `неподдерживаемая конструкция: ${node.getKindName()}`
      );
      return UNKNOWN;
  }
}

function convertLiteral(
  node: LiteralTypeNode,
  ctx: ConvertContext,
  path: string
): TypeExpr {
  const literal = node.getLiteral();
  switch (literal.getKind()) {
    case SyntaxKind.NullKeyword:
      return { kind: "null" };
    case SyntaxKind.TrueKeyword:
      return { kind: "literal", value: true };
    case SyntaxKind.FalseKeyword:
      return { kind: "literal", value: false };
    default: {
      // строки, числа, отрицательные числа (PrefixUnaryExpression)
      const type = node.getType();
      if (type.isStringLiteral() || type.isNumberLiteral()) {
        return { kind: "literal", value: type.getLiteralValue() as string | number };
      }
      ctx.reporter.report(
        "unsupported-type",
        path,
        `литерал не поддерживается: ${node.getText()}`
      );
      return UNKNOWN;
    }
  }
}

function convertTypeReference(
  node: TypeReferenceNode,
  ctx: ConvertContext,
  path: string,
  depth: number,
  skipAlias?: TsSymbol
): TypeExpr {
  const typeName = node.getTypeName();
  // у квалифицированных имён (z.infer, t.TypeOf) резолвим правый идентификатор
  const identifier = Node.isIdentifier(typeName) ? typeName : typeName.getRight();

  const rawSymbol = identifier.getSymbol();
  // импорты и реэкспорты — алиасные символы; резолвим до места объявления
  const symbol = rawSymbol?.getAliasedSymbol() ?? rawSymbol;
  const decl = symbol?.getDeclarations()[0];
  if (!symbol || !decl) {
    ctx.reporter.report(
      "unsupported-type",
      path,
      `не удалось разрешить тип: ${typeName.getText()}`
    );
    return UNKNOWN;
  }

  if (decl.getSourceFile().isDeclarationFile()) {
    return convertLibReference(decl, symbol.getName(), node, ctx, path, depth, skipAlias);
  }
  if (!Node.isIdentifier(typeName)) {
    // квалифицированный доступ к собственным типам (TS namespace) — в бэклоге
    ctx.reporter.report(
      "unsupported-type",
      path,
      `квалифицированное имя не поддерживается: ${typeName.getText()}`
    );
    return UNKNOWN;
  }
  if (Node.isClassDeclaration(decl)) {
    ctx.reporter.report(
      "unsupported-type",
      path,
      `классы не поддерживаются: ${symbol.getName()}`
    );
    return UNKNOWN;
  }
  if (Node.isEnumDeclaration(decl)) {
    return refTo(decl, ctx, path);
  }
  if (Node.isInterfaceDeclaration(decl) || Node.isTypeAliasDeclaration(decl)) {
    if (decl.getTypeParameters().length > 0) {
      // инстанцирование дженерика — раскрываем структурно, в схеме нет параметров типов
      return convertSemantic(node.getType(), node, ctx, path, depth + 1, skipAlias);
    }
    return refTo(decl, ctx, path);
  }
  ctx.reporter.report(
    "unsupported-type",
    path,
    `неподдерживаемое объявление: ${decl.getKindName()}`
  );
  return UNKNOWN;
}

function convertLibReference(
  decl: Node,
  name: string,
  node: TypeReferenceNode,
  ctx: ConvertContext,
  path: string,
  depth: number,
  skipAlias?: TsSymbol
): TypeExpr {
  const args = node.getTypeArguments();

  if (name === "Array" || name === "ReadonlyArray") {
    return {
      kind: "array",
      element: args[0] ? convertTypeNode(args[0], ctx, path, depth + 1) : UNKNOWN,
    };
  }
  if (name === "Record" && args.length === 2) {
    const keyKind = args[0].getKind();
    if (keyKind === SyntaxKind.StringKeyword || keyKind === SyntaxKind.NumberKeyword) {
      return { kind: "record", value: convertTypeNode(args[1], ctx, path, depth + 1) };
    }
    // литеральные ключи — это фиксированный набор полей, раскрываем как объект
    return convertSemantic(node.getType(), node, ctx, path, depth + 1, skipAlias);
  }
  if (name === "Date") {
    ctx.reporter.report("date-type", path, "поле типа Date");
    return { kind: "date" };
  }
  if (Node.isTypeAliasDeclaration(decl)) {
    // внешние алиасы раскрываем через результат работы компилятора: утилиты
    // lib (Partial, Pick, ReturnType...) и inference-типы библиотек описания
    // схем (z.infer у zod, InferOutput у valibot, TypeOf у io-ts и т.п.)
    return convertSemantic(node.getType(), node, ctx, path, depth + 1, skipAlias);
  }
  // номинальные типы lib (Map, Set, Promise, классы) структурно не раскрываем
  ctx.reporter.report("unsupported-type", path, `внешний тип не поддерживается: ${name}`);
  return UNKNOWN;
}

function refTo(decl: NamedDeclaration, ctx: ConvertContext, path: string): TypeExpr {
  if (decl.isDefaultExport()) {
    ctx.reporter.report(
      "default-export",
      path,
      `default-экспорт пока не поддерживается: ${decl.getName()}`
    );
    return UNKNOWN;
  }
  const { namespace, name } = ctx.enqueue(decl);
  return { kind: "ref", namespace, name };
}

export function convertMembers(
  node: InterfaceDeclaration | TypeLiteralNode,
  ctx: ConvertContext,
  path: string,
  depth: number
): TypeExpr {
  if (depth > MAX_DEPTH) {
    ctx.reporter.report("expansion-depth", path, "превышена глубина разбора типа");
    return UNKNOWN;
  }

  // Map сохраняет позицию поля при переопределении: базовые поля кладём первыми,
  // собственные затирают одноимённые, оставаясь на месте базового.
  const props = new Map<string, PropertySig>();

  if (Node.isInterfaceDeclaration(node)) {
    for (const ext of node.getExtends()) {
      for (const prop of expandBase(ext, ctx, path, depth)) {
        props.set(prop.name, prop);
      }
    }
  }

  for (const prop of node.getProperties()) {
    const name = prop.getName();
    const propPath = `${path}.${name}`;
    const typeNode = prop.getTypeNode();
    let type: TypeExpr;
    if (typeNode) {
      type = convertTypeNode(typeNode, ctx, propPath, depth + 1);
    } else {
      ctx.reporter.report("unsupported-type", propPath, "поле без аннотации типа");
      type = UNKNOWN;
    }
    props.set(name, { name, optional: prop.hasQuestionToken(), type });
  }

  for (const method of node.getMethods()) {
    const name = method.getName();
    ctx.reporter.report(
      "behavior-in-type",
      `${path}.${name}`,
      `метод в типе данных: ${name}`
    );
    props.set(name, { name, optional: method.hasQuestionToken(), type: UNKNOWN });
  }

  if (node.getCallSignatures().length > 0 || node.getConstructSignatures().length > 0) {
    ctx.reporter.report("behavior-in-type", path, "сигнатура вызова в типе данных");
  }

  const indexSignatures = node.getIndexSignatures();
  if (indexSignatures.length > 0 && props.size === 0) {
    const valueNode = indexSignatures[0].getReturnTypeNode();
    return {
      kind: "record",
      value: valueNode ? convertTypeNode(valueNode, ctx, path, depth + 1) : UNKNOWN,
    };
  }

  return { kind: "object", properties: [...props.values()] };
}

function expandBase(
  ext: ExpressionWithTypeArguments,
  ctx: ConvertContext,
  path: string,
  depth: number
): PropertySig[] {
  const raw = ext.getExpression().getSymbol();
  const symbol = raw?.getAliasedSymbol() ?? raw;
  const decl = symbol?.getDeclarations()[0];

  if (
    decl &&
    Node.isInterfaceDeclaration(decl) &&
    decl.getTypeParameters().length === 0 &&
    !decl.getSourceFile().isDeclarationFile()
  ) {
    const body = convertMembers(decl, ctx, path, depth + 1);
    return body.kind === "object" ? body.properties : [];
  }
  // дженерик-база и прочее — семантическое раскрытие
  const expanded = convertSemantic(ext.getType(), ext, ctx, path, depth + 1);
  return expanded.kind === "object" ? expanded.properties : [];
}

/**
 * Семантическая конвертация — для типов, которых нет в синтаксисе исходника
 * (инстанцирования дженериков, утилитарные типы, пересечения, mapped types).
 */
export function convertSemantic(
  type: Type,
  location: Node,
  ctx: ConvertContext,
  path: string,
  depth: number,
  skipAlias?: TsSymbol
): TypeExpr {
  if (depth > MAX_DEPTH) {
    ctx.reporter.report(
      "expansion-depth",
      path,
      `превышена глубина раскрытия типа: ${type.getText()}`
    );
    return UNKNOWN;
  }

  // Ссылка на алиас без параметров. Проверяем до примитивов: компилятор
  // сохраняет символ алиаса и на примитивных типах (type UserId = string).
  const aliasSymbol = type.getAliasSymbol();
  if (
    aliasSymbol &&
    aliasSymbol.compilerSymbol !== skipAlias?.compilerSymbol &&
    type.getAliasTypeArguments().length === 0
  ) {
    const aliasDecl = aliasSymbol.getDeclarations()[0];
    if (
      aliasDecl &&
      Node.isTypeAliasDeclaration(aliasDecl) &&
      !aliasDecl.getSourceFile().isDeclarationFile() &&
      aliasDecl.getTypeParameters().length === 0
    ) {
      return refTo(aliasDecl, ctx, path);
    }
  }

  if (type.isString()) return { kind: "string" };
  if (type.isNumber()) return { kind: "number" };
  if (type.isBooleanLiteral()) return { kind: "literal", value: type.getText() === "true" };
  if (type.isBoolean()) return { kind: "boolean" };
  if (type.isStringLiteral() || type.isNumberLiteral()) {
    return { kind: "literal", value: type.getLiteralValue() as string | number };
  }
  if (type.isNull()) return { kind: "null" };
  if (type.isUndefined()) return { kind: "undefined" };
  if (type.isAny() || type.isUnknown()) return UNKNOWN;

  // enum и члены enum — до разбора union: enum-тип сам является union
  const symbolDecl = type.getSymbol()?.getDeclarations()?.[0];
  if (symbolDecl) {
    if (Node.isEnumDeclaration(symbolDecl)) return refTo(symbolDecl, ctx, path);
    if (Node.isEnumMember(symbolDecl)) {
      const parent = symbolDecl.getParent();
      if (Node.isEnumDeclaration(parent)) return refTo(parent, ctx, path);
    }
  }

  if (type.isUnion()) {
    const variants = mergeBooleanLiterals(
      type.getUnionTypes().map((v) => convertSemantic(v, location, ctx, path, depth + 1))
    );
    return variants.length === 1 ? variants[0] : { kind: "union", variants };
  }
  if (type.isArray()) {
    const element = type.getArrayElementType();
    return {
      kind: "array",
      element: element ? convertSemantic(element, location, ctx, path, depth + 1) : UNKNOWN,
    };
  }
  if (type.isTuple()) {
    return {
      kind: "tuple",
      elements: type
        .getTupleElements()
        .map((e) => convertSemantic(e, location, ctx, path, depth + 1)),
    };
  }
  if (type.getCallSignatures().length > 0) {
    ctx.reporter.report(
      "behavior-in-type",
      path,
      `функциональный тип в данных: ${type.getText()}`
    );
    return UNKNOWN;
  }

  if (type.isIntersection() || type.isObject()) {
    if (symbolDecl) {
      if (Node.isClassDeclaration(symbolDecl)) {
        ctx.reporter.report(
          "unsupported-type",
          path,
          `классы не поддерживаются: ${type.getSymbol()?.getName()}`
        );
        return UNKNOWN;
      }
      if (Node.isInterfaceDeclaration(symbolDecl)) {
        if (symbolDecl.getSourceFile().isDeclarationFile()) {
          const name = type.getSymbol()!.getName();
          if (name === "Date") {
            ctx.reporter.report("date-type", path, "поле типа Date");
            return { kind: "date" };
          }
          if (name === "Array" || name === "ReadonlyArray") {
            const el = type.getTypeArguments()[0];
            return {
              kind: "array",
              element: el ? convertSemantic(el, location, ctx, path, depth + 1) : UNKNOWN,
            };
          }
          ctx.reporter.report(
            "unsupported-type",
            path,
            `внешний тип не поддерживается: ${name}`
          );
          return UNKNOWN;
        }
        if (symbolDecl.getTypeParameters().length === 0) {
          return refTo(symbolDecl, ctx, path);
        }
      }
    }

    // структурное раскрытие
    const stringIndex = type.getStringIndexType();
    const numberIndex = type.getNumberIndexType();
    const propSymbols = type.getProperties();
    if ((stringIndex || numberIndex) && propSymbols.length === 0) {
      const valueType = (stringIndex ?? numberIndex)!;
      return {
        kind: "record",
        value: convertSemantic(valueType, location, ctx, path, depth + 1),
      };
    }

    const properties: PropertySig[] = [];
    for (const propSymbol of propSymbols) {
      const name = propSymbol.getName();
      const optional = propSymbol.hasFlags(SymbolFlags.Optional);
      let expr = convertSemantic(
        propSymbol.getTypeAtLocation(location),
        location,
        ctx,
        `${path}.${name}`,
        depth + 1
      );
      if (optional) expr = stripUndefined(expr);
      properties.push({ name, optional, type: expr });
    }
    return { kind: "object", properties };
  }

  ctx.reporter.report("unsupported-type", path, `не удалось разобрать тип: ${type.getText()}`);
  return UNKNOWN;
}

/** У optional-полей убираем неявный undefined, добавленный компилятором. */
function stripUndefined(expr: TypeExpr): TypeExpr {
  if (expr.kind !== "union") return expr;
  const variants = expr.variants.filter((v) => v.kind !== "undefined");
  if (variants.length === 0) return { kind: "undefined" };
  return variants.length === 1 ? variants[0] : { kind: "union", variants };
}

/** Компилятор расщепляет boolean в union на true | false — склеиваем обратно. */
function mergeBooleanLiterals(variants: TypeExpr[]): TypeExpr[] {
  const isBoolLit = (v: TypeExpr, value: boolean) =>
    v.kind === "literal" && v.value === value;
  const hasTrue = variants.some((v) => isBoolLit(v, true));
  const hasFalse = variants.some((v) => isBoolLit(v, false));
  if (!hasTrue || !hasFalse) return variants;

  const result: TypeExpr[] = [];
  let inserted = false;
  for (const v of variants) {
    if (isBoolLit(v, true) || isBoolLit(v, false)) {
      if (!inserted) {
        result.push({ kind: "boolean" });
        inserted = true;
      }
    } else {
      result.push(v);
    }
  }
  return result;
}
