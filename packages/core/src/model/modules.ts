import { satisfies, valid, validRange } from "semver";

export interface ModuleRequirement {
  readonly id: string;
  readonly range: string;
}

export interface ContentModule {
  readonly id: string;
  readonly version: string;
  readonly requires?: readonly ModuleRequirement[];
}

export function compareModuleIds(
  left: { readonly id: string },
  right: { readonly id: string },
): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function resolveModules(modules: readonly ContentModule[]): readonly ContentModule[] {
  const byId = new Map<string, ContentModule>();
  for (const module of modules) {
    if (byId.has(module.id)) throw new TypeError(`Duplicate module id: ${module.id}`);
    if (!valid(module.version))
      throw new TypeError(`Invalid module version: ${module.id}@${module.version}`);
    const requires = (module.requires ?? []).map((requirement) => {
      if (!validRange(requirement.range)) {
        throw new TypeError(`Invalid dependency range: ${requirement.id}@${requirement.range}`);
      }
      return Object.freeze({ ...requirement });
    });
    byId.set(module.id, Object.freeze({ ...module, requires: Object.freeze(requires) }));
  }
  const resolved: ContentModule[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new TypeError(`Module dependency cycle at ${id}`);
    const module = byId.get(id);
    if (!module) throw new TypeError(`Missing module dependency: ${id}`);
    visiting.add(id);
    for (const requirement of [...(module.requires ?? [])].sort(compareModuleIds)) {
      const dependency = byId.get(requirement.id);
      if (!dependency) throw new TypeError(`Missing module dependency: ${requirement.id}`);
      if (!satisfies(dependency.version, requirement.range)) {
        throw new TypeError(
          `Module ${id} requires ${requirement.id}@${requirement.range}, found ${dependency.version}`,
        );
      }
      visit(requirement.id);
    }
    visiting.delete(id);
    visited.add(id);
    resolved.push(module);
  };
  for (const id of [...byId.keys()].sort()) visit(id);
  return Object.freeze(resolved);
}
