import { createCjkPlugin } from "@streamdown/cjk";
import { createMathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { Streamdown, type StreamdownTranslations } from "streamdown";
import { normalizeStudentMarkdown } from "./markdownNormalize";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";
import "streamdown/styles.css";

const streamdownMath = createMathPlugin({
  singleDollarTextMath: true,
  errorColor: "rgba(0, 48, 38, 0.72)",
});

const streamdownCjk = createCjkPlugin();

const streamdownMermaid = createMermaidPlugin({
  config: {
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
  },
});

const streamdownTranslations: Partial<StreamdownTranslations> = {
  close: "关闭",
  copied: "已复制",
  copyCode: "复制文本",
  copyLink: "复制链接",
  copyTable: "复制表格",
  copyTableAsCsv: "复制为 CSV",
  copyTableAsMarkdown: "复制为 Markdown",
  copyTableAsTsv: "复制为 TSV",
  downloadDiagram: "下载流程图",
  downloadDiagramAsMmd: "下载 Mermaid",
  downloadDiagramAsPng: "下载 PNG",
  downloadDiagramAsSvg: "下载 SVG",
  downloadFile: "下载文件",
  downloadImage: "下载图片",
  downloadTable: "下载表格",
  downloadTableAsCsv: "下载 CSV",
  downloadTableAsMarkdown: "下载 Markdown",
  exitFullscreen: "退出全屏",
  externalLinkWarning: "即将打开外部链接",
  imageNotAvailable: "图片不可用",
  mermaidFormatMmd: "Mermaid",
  mermaidFormatPng: "PNG",
  mermaidFormatSvg: "SVG",
  openExternalLink: "打开外部链接",
  openLink: "打开链接",
  tableFormatCsv: "CSV",
  tableFormatMarkdown: "Markdown",
  tableFormatTsv: "TSV",
  viewFullscreen: "全屏查看",
};

export function AiStreamingMarkdown({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const value = normalizeStudentMarkdown(text);
  if (!value.trim()) return null;

  return (
    <Streamdown
      animated={{ animation: "blurIn", duration: 180, easing: "ease-out", sep: "word", stagger: 7 }}
      className={["ai-markdown", "ai-markdown-streaming", className].filter(Boolean).join(" ")}
      controls={{
        table: { copy: false, download: false, fullscreen: true },
        code: false,
        mermaid: { copy: false, download: false, fullscreen: true, panZoom: true },
      }}
      dir="auto"
      isAnimating
      lineNumbers={false}
      linkSafety={{ enabled: true }}
      mode="streaming"
      parseIncompleteMarkdown
      plugins={{ cjk: streamdownCjk, math: streamdownMath, mermaid: streamdownMermaid }}
      skipHtml
      translations={streamdownTranslations}
    >
      {value}
    </Streamdown>
  );
}
