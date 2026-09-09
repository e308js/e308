import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new TypeError("usage: node extract-upstream.mjs <projects.js> <inventory.json>");
}

const sourceText = await readFile(inputPath, "utf8");
const source = ts.createSourceFile(
  inputPath,
  sourceText,
  ts.ScriptTarget.ESNext,
  true,
  ts.ScriptKind.JS,
);
const projects = [];
const ignoredCalls = new Set(["activeProjects", "displayMessage", "document", "Math", "projects"]);

for (const statement of source.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || !/^project\w+$/.test(declaration.name.text)) continue;
    if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer))
      continue;
    projects.push(extractProject(declaration.name.text, declaration.initializer));
  }
}

const inventory = {
  schema: "e308-paperclips-project-inventory",
  schemaVersion: 1,
  source: "projects.js?v3",
  sourceSha256: "05034c51809bc0632e8963e671c8e68c68604ca3643da291e0c6fabc86152774",
  count: projects.length,
  projects,
};
await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`);

function extractProject(sourceVariable, object) {
  const trigger = functionProperty(object, "trigger");
  const cost = functionProperty(object, "cost");
  const effect = functionProperty(object, "effect");
  return {
    sourceVariable,
    sourceId: stringProperty(object, "id"),
    title: requiredPropertyText(object, "title"),
    priceTag: propertyText(object, "priceTag"),
    description: propertyText(object, "description"),
    trigger: returnedExpression(trigger),
    cost: returnedExpression(cost),
    effectWrites: effect ? assignedRoots(effect) : [],
    effectCalls: effect ? calledRoots(effect) : [],
  };
}

function property(object, name) {
  return object.properties.find((candidate) => propertyName(candidate.name) === name);
}

function propertyName(name) {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

function stringProperty(object, name) {
  const value = property(object, name);
  if (!value || !ts.isPropertyAssignment(value) || !ts.isStringLiteral(value.initializer)) {
    throw new TypeError(`Paperclips project is missing string field: ${name}`);
  }
  return value.initializer.text;
}

function propertyText(object, name) {
  const value = property(object, name);
  if (!value || !ts.isPropertyAssignment(value)) return null;
  if (ts.isStringLiteral(value.initializer)) return value.initializer.text.trim();
  if (value.initializer.kind === ts.SyntaxKind.NullKeyword) return null;
  return normalize(value.initializer.getText(source));
}

function requiredPropertyText(object, name) {
  const value = propertyText(object, name);
  if (value === null) throw new TypeError(`Paperclips project is missing field: ${name}`);
  return value;
}

function functionProperty(object, name) {
  const value = property(object, name);
  if (!value || !ts.isPropertyAssignment(value)) return undefined;
  return ts.isFunctionExpression(value.initializer) ? value.initializer : undefined;
}

function returnedExpression(fn) {
  if (!fn) return null;
  let expression = null;
  visit(fn.body, (node) => {
    if (expression === null && ts.isReturnStatement(node) && node.expression) {
      expression = normalize(node.expression.getText(source));
    }
  });
  return expression;
}

function assignedRoots(fn) {
  const roots = new Set();
  visit(fn.body, (node) => {
    if (ts.isBinaryExpression(node) && isAssignment(node.operatorToken.kind)) {
      addRoot(roots, node.left);
    }
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
      if (
        node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken
      ) {
        addRoot(roots, node.operand);
      }
    }
  });
  return [...roots].filter((name) => !/^project\w+$/.test(name)).sort();
}

function calledRoots(fn) {
  const roots = new Set();
  visit(fn.body, (node) => {
    if (ts.isCallExpression(node)) {
      const root = rootIdentifier(node.expression);
      if (root && !ignoredCalls.has(root) && !/^project\w+$/.test(root)) roots.add(root);
    }
  });
  return [...roots].sort();
}

function visit(node, inspect) {
  inspect(node);
  node.forEachChild((child) => visit(child, inspect));
}

function isAssignment(kind) {
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}

function addRoot(roots, expression) {
  const root = rootIdentifier(expression);
  if (root) roots.add(root);
}

function rootIdentifier(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return rootIdentifier(expression.expression);
  }
  return undefined;
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}
