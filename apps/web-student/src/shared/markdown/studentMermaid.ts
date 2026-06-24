import mermaid from "mermaid";

let initialized = false;

export function ensureStudentMermaidInitialized(): void {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
      primaryColor: "#f7fbf4",
      primaryTextColor: "#153128",
      primaryBorderColor: "#8ab79a",
      lineColor: "#00663b",
      secondaryColor: "#fff8df",
      tertiaryColor: "#e8f4ed",
      fontFamily: "inherit",
    },
  });
  initialized = true;
}

export async function renderStudentMermaid(id: string, chart: string): Promise<string> {
  ensureStudentMermaidInitialized();
  const result = await mermaid.render(id, chart);
  return result.svg;
}
