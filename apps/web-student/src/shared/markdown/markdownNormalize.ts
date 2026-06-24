function normalizeInlineMathDelimiters(segment: string): string {
  return segment
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, content: string) => `$$${content}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, content: string) => `$${content}$`);
}

export function normalizeStudentMarkdown(text: string | null | undefined): string {
  const value = String(text || "").replace(/\r\n/g, "\n");
  if (!value.trim()) return value;

  const parts = value.split(/(```[\s\S]*?```)/g);
  return parts.map((part) => (part.startsWith("```") ? part : normalizeInlineMathDelimiters(part))).join("");
}
