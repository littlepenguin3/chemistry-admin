import { AiStaticMarkdown } from "../../components/AiMarkdown";
import type { AiRichContentOpenContext } from "./aiRichContentArtifacts";

export function AiMarkdownBlock({
  text,
  className = "",
  artifactContext,
}: {
  text: string | null | undefined;
  className?: string;
  artifactContext?: AiRichContentOpenContext;
}) {
  const value = String(text || "");
  if (!value.trim()) return null;
  return <AiStaticMarkdown text={value} className={className} artifactContext={artifactContext} />;
}
