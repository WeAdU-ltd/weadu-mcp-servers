export interface PageSignals {
  title: string | null;
  hasMetaDescription: boolean;
  metaRobots: string | null;
  canonical: string | null;
  jsonLdTypes: string[];
  noindex: boolean;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const inner = tag.replace(/^<\s*[a-zA-Z0-9]+/, "").replace(/\/?>$/, "");
  for (const match of inner.matchAll(pattern)) {
    const key = match[1].toLowerCase();
    if (!attributes.has(key)) {
      attributes.set(key, decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""));
    }
  }
  return attributes;
}

function tags(html: string, name: string): Map<string, string>[] {
  const pattern = new RegExp(`<${name}\\b[^>]*>`, "gi");
  return [...html.matchAll(pattern)].map((match) => parseAttributes(match[0]));
}

function collectTypes(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, out);
    return;
  }
  if (node === null || typeof node !== "object") {
    return;
  }
  const record = node as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") {
    out.push(type);
  } else if (Array.isArray(type)) {
    for (const item of type) if (typeof item === "string") out.push(item);
  }
  for (const [key, value] of Object.entries(record)) {
    if (key !== "@type") collectTypes(value, out);
  }
}

export function extractSignals(html: string, xRobotsTag: string | null): PageSignals {
  const source = typeof html === "string" ? html : "";
  const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  let title: string | null = null;
  if (titleMatch) {
    const text = decodeEntities(titleMatch[1].replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
    title = Array.from(text).slice(0, 200).join("");
  }

  const metas = tags(source, "meta");
  const metaNamed = (name: string) => metas.find((attrs) => attrs.get("name")?.trim().toLowerCase() === name);
  const description = metaNamed("description");
  const robots = metaNamed("robots");
  const metaRobots = robots ? (robots.get("content") ?? "") : null;

  const canonicalLink = tags(source, "link").find((attrs) =>
    (attrs.get("rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"),
  );

  const types: string[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of source.matchAll(scriptPattern)) {
    const attrs = parseAttributes(`<script${match[1]}>`);
    if ((attrs.get("type") ?? "").trim().toLowerCase() !== "application/ld+json") continue;
    try {
      collectTypes(JSON.parse(match[2]), types);
    } catch {
      // Invalid JSON-LD block: ignored on purpose.
    }
  }

  const noindex = /noindex/i.test(metaRobots ?? "") || /noindex/i.test(xRobotsTag ?? "");
  return {
    title,
    hasMetaDescription: (description?.get("content") ?? "").trim() !== "",
    metaRobots,
    canonical: canonicalLink ? (canonicalLink.get("href") ?? null) : null,
    jsonLdTypes: [...new Set(types)],
    noindex,
  };
}
