import type { BrowserHost } from "./types.js";

export function bindBrowserLifecycle<N>(
  host: BrowserHost<N>,
  document: Document = globalThis.document,
  window: Pick<Window, "addEventListener" | "removeEventListener"> = globalThis,
): () => void {
  const visibility = () => void host.handleLifecycle(document.hidden ? "hidden" : "visible");
  const pagehide = () => void host.handleLifecycle("pagehide");
  const pageshow = () => void host.handleLifecycle("pageshow");
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("pageshow", pageshow);
  return () => {
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("pagehide", pagehide);
    window.removeEventListener("pageshow", pageshow);
  };
}
