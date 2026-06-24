import { useEffect, useId, useState } from "react";
import { Maximize2 } from "lucide-react";
import type { AiRichContentArtifact } from "./aiRichContentArtifacts";
import { renderStudentMermaid } from "./studentMermaid";

export function AiMermaidBlock({
  chart,
  artifact,
  onOpenArtifact,
}: {
  chart: string;
  artifact?: AiRichContentArtifact;
  onOpenArtifact?: (artifact: AiRichContentArtifact) => void;
}) {
  const rawId = useId();
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const detailButton =
    artifact && onOpenArtifact ? (
      <button type="button" className="ai-md-artifact-open" onClick={() => onOpenArtifact(artifact)} aria-label={`查看${artifact.title}`}>
        <Maximize2 size={13} />
        <span>查看详情</span>
      </button>
    ) : null;

  useEffect(() => {
    let cancelled = false;
    const id = `ai-mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    renderStudentMermaid(id, chart)
      .then((result) => {
        if (cancelled) return;
        setSvg(result);
        setError("");
      })
      .catch(() => {
        if (cancelled) return;
        setSvg("");
        setError("Mermaid render failed");
      });

    return () => {
      cancelled = true;
    };
  }, [chart, rawId]);

  if (svg) {
    return (
      <div className="ai-md-mermaid-block" data-streamdown="mermaid-block">
        <div className="ai-md-artifact-toolbar">
          <span>mermaid</span>
          {detailButton}
        </div>
        <div className="ai-md-mermaid" data-streamdown="mermaid" role="img" aria-label="化学学习流程图" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-md-mermaid-block ai-md-mermaid-error" data-streamdown="mermaid-block">
        <div className="ai-md-artifact-toolbar">
          <span>mermaid</span>
          {detailButton}
        </div>
        <strong>流程图暂时无法渲染</strong>
        <pre className="ai-md-code-block">{chart}</pre>
      </div>
    );
  }

  return (
    <div className="ai-md-mermaid-block" data-streamdown="mermaid-block">
      <div className="ai-md-artifact-toolbar">
        <span>mermaid</span>
        {detailButton}
      </div>
      <div className="ai-md-mermaid-loading">正在生成流程图...</div>
    </div>
  );
}
