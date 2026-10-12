/**
 * DOM shim untuk test komponen (.tsx) di `bun test`: happy-dom tanpa
 * framework runner. Disengaja terkurasi (bukan salin semua properti window)
 * agar global backend (`fetch`, `Request`, `Blob`, …) milik bun tidak
 * tertimpa untuk file test lain dalam proses yang sama.
 */
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;

const put = (name: string, bind = false): void => {
  const value = (window as unknown as Record<string, unknown>)[name];
  if (value === undefined) return;
  g[name] =
    bind && typeof value === "function" ? (value as (...args: never[]) => unknown).bind(window) : value;
};

for (const name of [
  "window",
  "document",
  "navigator",
  "Document",
  "HTMLDocument",
  "DocumentFragment",
  "Element",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "HTMLFormElement",
  "HTMLDivElement",
  "HTMLSpanElement",
  "HTMLHeadElement",
  "HTMLBodyElement",
  "Node",
  "Text",
  "Comment",
  "Event",
  "CustomEvent",
  "KeyboardEvent",
  "MouseEvent",
  "FocusEvent",
  "InputEvent",
  "SubmitEvent",
  "PointerEvent",
  "MutationObserver",
  "Range",
  "Selection",
  "SVGElement",
  "NodeList",
  "DOMParser",
]) {
  put(name);
}
for (const name of ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia"]) {
  put(name, true);
}
if (g["requestAnimationFrame"] === undefined) {
  g["requestAnimationFrame"] = (cb: (...args: unknown[]) => void): number =>
    setTimeout(() => cb(Date.now()), 16) as unknown as number;
  g["cancelAnimationFrame"] = (id: number): void => clearTimeout(id);
}
(g as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"] = true;
