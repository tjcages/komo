import { isValidElement, type ReactNode } from "react";

const escape = (value: unknown) =>
  String(value).replace(
    /[&"<>]/g,
    (character) =>
      ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[character]!
  );

/** Serialize the pinned, hook-free icon components without mounting React roots. */
export function staticSvg(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean")
    return "";
  if (Array.isArray(node)) return node.map(staticSvg).join("");
  if (typeof node === "string" || typeof node === "number") return escape(node);
  if (
    !isValidElement<Record<string, unknown>>(node) ||
    typeof node.type !== "string"
  )
    throw new Error("Icons must contain static SVG elements.");
  const attributes = Object.entries(node.props)
    .flatMap(([key, value]) => {
      if (key === "children" || key === "ref" || key === "key" || value == null)
        return [];
      if (
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean"
      )
        throw new Error(`Unsupported SVG attribute: ${key}`);
      const name =
        key === "className"
          ? "class"
          : key === "viewBox"
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      return [` ${name}="${escape(value)}"`];
    })
    .join("");
  return `<${node.type}${attributes}>${staticSvg(node.props.children as ReactNode)}</${node.type}>`;
}
