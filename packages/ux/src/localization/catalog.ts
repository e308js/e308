import type { QuantityFormatter } from "../format/numbers.js";
import { formatDuration } from "../format/time.js";
import type {
  DescriptionNode,
  MessageArgument,
  MessageCatalog,
  MessageToken,
  TextResolver,
  TextValue,
} from "./types.js";

export interface CatalogOptions<N> {
  readonly messages?: MessageCatalog;
  readonly quantities: QuantityFormatter<N>;
  readonly missing?: "key" | "error";
}

export function createTextResolver<N>(options: CatalogOptions<N>): TextResolver<N> {
  const argument = (value: MessageArgument<N>): string => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return value.kind === "quantity"
      ? options.quantities.format(value.value, value.format)
      : formatDuration(value.ms);
  };
  return {
    argument,
    text(value) {
      if (typeof value === "string") return value;
      const template = options.messages?.[value.key];
      if (template === undefined) {
        if (options.missing === "error") throw new TypeError(`missing message: ${value.key}`);
        return value.key;
      }
      return interpolate(template, value, argument);
    },
  };
}

function interpolate<N>(
  template: string,
  token: MessageToken<N>,
  render: (value: MessageArgument<N>) => string,
): string {
  const required = new Set(
    [...template.matchAll(/\{([A-Za-z][\w-]*)\}/g)]
      .map((match) => match[1])
      .filter((key): key is string => key !== undefined),
  );
  const args = token.args ?? {};
  for (const key of required) {
    if (!(key in args)) throw new TypeError(`message ${token.key} is missing argument ${key}`);
  }
  for (const key of Object.keys(args)) {
    if (!required.has(key))
      throw new TypeError(`message ${token.key} has unexpected argument ${key}`);
  }
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (_, key: string) =>
    render(args[key] as MessageArgument<N>),
  );
}

export function appendDescription<N>(
  parent: Node,
  nodes: readonly DescriptionNode<N>[],
  resolver: TextResolver<N>,
): void {
  const document = parent.ownerDocument;
  if (!document) throw new TypeError("description parent must belong to a document");
  for (const node of nodes) parent.appendChild(descriptionNode(document, node, resolver));
}

function descriptionNode<N>(
  document: Document,
  node: DescriptionNode<N>,
  resolver: TextResolver<N>,
): Node {
  if (node.kind === "text") return document.createTextNode(node.value);
  if (node.kind === "message") return document.createTextNode(resolver.text(node.token));
  if (node.kind === "break") return document.createElement("br");
  if (node.kind === "code") return elementWithText(document, "code", node.value);
  const tag = node.kind === "link" ? "a" : node.kind === "strong" ? "strong" : "em";
  const element = document.createElement(tag);
  if (node.kind === "link") {
    if (!isAllowedLink(node.href)) throw new TypeError(`unsupported link target: ${node.href}`);
    element.setAttribute("href", node.href);
  }
  appendDescription(element, node.children, resolver);
  return element;
}

function elementWithText(document: Document, tag: string, value: TextValue): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = typeof value === "string" ? value : value.key;
  return element;
}

export function isAllowedLink(href: string): boolean {
  return /^(?:https?:|mailto:|#|\/|\.\.?\/)/.test(href);
}
