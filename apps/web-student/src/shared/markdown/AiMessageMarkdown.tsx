import { Suspense, lazy } from "react";
import { AiMarkdownBlock } from "./AiMarkdownBlock";
import type { AiRichContentOpenContext } from "./aiRichContentArtifacts";

const LazyAiStreamingMarkdown = lazy(async () => {
  const module = await import("./AiStreamingMarkdown");
  return { default: module.AiStreamingMarkdown };
});

function MarkdownFallback({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={["ai-markdown", className].filter(Boolean).join(" ")}>
      <p className="ai-md-paragraph">{text}</p>
    </div>
  );
}

export function AiMessageMarkdown({
  text,
  className = "",
  streaming = false,
  artifactContext,
}: {
  text: string | null | undefined;
  className?: string;
  streaming?: boolean;
  artifactContext?: AiRichContentOpenContext;
}) {
  const value = String(text || "");
  if (!value.trim()) return null;
  if (!streaming) return <AiMarkdownBlock text={value} className={className} artifactContext={artifactContext} />;
  return (
    <Suspense fallback={<MarkdownFallback text={value} className={className} />}>
      <LazyAiStreamingMarkdown text={value} className={className} />
    </Suspense>
  );
}
