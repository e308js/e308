import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import ts from "typescript";

const ROOTS = ["packages", "tools", "examples"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const SKIPPED_DIRECTORIES = new Set(["dist", "node_modules", "coverage"]);

export interface SizeViolation {
  readonly path: string;
  readonly actual: number;
  readonly limit: number;
}

export interface StructureReport {
  readonly size: readonly SizeViolation[];
  readonly functions: readonly SizeViolation[];
  readonly duplicateBlocks: readonly string[];
  readonly forbiddenImports: readonly string[];
}

export function lineLimit(path: string): number {
  if (/\.(test|spec)\.[jt]sx?$/.test(path)) return 500;
  if (/\/index\.[jt]s$/.test(path)) return 80;
  return 350;
}

async function collect(path: string): Promise<string[]> {
  const info = await stat(path).catch(() => undefined);
  if (!info) return [];
  if (info.isFile()) return SOURCE_EXTENSIONS.has(extname(path)) ? [path] : [];
  if (SKIPPED_DIRECTORIES.has(path.split("/").at(-1) ?? "")) return [];
  const entries = await readdir(path);
  return (await Promise.all(entries.map((entry) => collect(join(path, entry))))).flat();
}

async function sourceFiles(root: string): Promise<string[]> {
  return (await Promise.all(ROOTS.map((path) => collect(join(root, path))))).flat();
}

export async function findSizeViolations(root = process.cwd()): Promise<SizeViolation[]> {
  const files = await sourceFiles(root);
  const violations: SizeViolation[] = [];
  for (const path of files) {
    const contents = await readFile(path, "utf8");
    const actual = contents === "" ? 0 : contents.split(/\r?\n/).length;
    const displayPath = relative(root, path).replaceAll("\\", "/");
    const limit = lineLimit(`/${displayPath}`);
    if (actual > limit) violations.push({ path: displayPath, actual, limit });
  }
  return violations;
}

export async function inspectStructure(root = process.cwd()): Promise<StructureReport> {
  const files = await sourceFiles(root);
  const functions: SizeViolation[] = [];
  const forbiddenImports: string[] = [];
  const tokenOwners = new Map<string, string>();
  const duplicateBlocks = new Set<string>();

  for (const path of files.filter((file) => /\.[jt]sx?$/.test(file))) {
    const contents = await readFile(path, "utf8");
    const displayPath = relative(root, path).replaceAll("\\", "/");
    inspectTypeScript(displayPath, contents, functions, forbiddenImports);
    inspectDuplicates(displayPath, contents, tokenOwners, duplicateBlocks);
  }
  return {
    size: await findSizeViolations(root),
    functions,
    duplicateBlocks: [...duplicateBlocks].sort(),
    forbiddenImports,
  };
}

function inspectTypeScript(
  path: string,
  contents: string,
  functions: SizeViolation[],
  forbiddenImports: string[],
): void {
  const source = ts.createSourceFile(path, contents, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    const body = ts.isFunctionLike(node) && "body" in node ? node.body : undefined;
    if (body) {
      const start = source.getLineAndCharacterOfPosition(body.getStart(source)).line;
      const end = source.getLineAndCharacterOfPosition(body.getEnd()).line;
      const actual = end - start + 1;
      if (actual > 80) functions.push({ path, actual, limit: 80 });
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      if (path.startsWith("packages/core/src/") && !path.includes("/browser/")) {
        if (/^(react|vue|svelte|solid-js|lit|@angular|node:)/.test(specifier)) {
          forbiddenImports.push(`${path}: ${specifier}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function inspectDuplicates(
  path: string,
  contents: string,
  owners: Map<string, string>,
  duplicates: Set<string>,
): void {
  const tokens =
    contents.match(/[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|===|!==|=>|[{}()[\].,+*/%<>?:=-]/g) ?? [];
  for (let index = 0; index + 50 <= tokens.length; index += 1) {
    const block = tokens.slice(index, index + 50).join(" ");
    const owner = owners.get(block);
    if (owner && owner !== path) duplicates.add(`${owner} <> ${path}`);
    else owners.set(block, path);
  }
}

export async function runStructureCheck(root = process.cwd()): Promise<number> {
  const report = await inspectStructure(root);
  for (const violation of [...report.size, ...report.functions]) {
    console.error(`${violation.path}: ${violation.actual} lines exceeds ${violation.limit}`);
  }
  for (const duplicate of report.duplicateBlocks) console.error(`duplicate block: ${duplicate}`);
  for (const forbidden of report.forbiddenImports) console.error(`forbidden import: ${forbidden}`);
  return report.size.length +
    report.functions.length +
    report.duplicateBlocks.length +
    report.forbiddenImports.length >
    0
    ? 1
    : 0;
}

export function isEntrypoint(path: string | undefined): boolean {
  return path?.endsWith("structure.ts") ?? false;
}

/* v8 ignore next 3 -- exercised by the package-level check:structure command */
if (isEntrypoint(process.argv[1])) {
  process.exitCode = await runStructureCheck();
}
