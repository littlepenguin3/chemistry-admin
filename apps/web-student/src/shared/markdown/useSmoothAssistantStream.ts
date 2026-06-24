import { useCallback, useEffect, useRef } from "react";

type SmoothStreamOptions = {
  onDisplayText: (text: string) => void;
};

const STREAM_TICK_MS = 48;
const MIN_RELEASE_CHARS = 10;
const MAX_RELEASE_CHARS = 72;
const HARD_RELEASE_CHARS = 140;
const BOUNDARY_PATTERN = /[\n\r。！？；：，、,.!?;:]/u;

function segmentWithIntl(text: string, maxLength: number): number {
  const SegmenterCtor = (
    Intl as typeof Intl & {
      Segmenter?: new (locale: string, options: { granularity: "word" }) => {
        segment(value: string): Iterable<{ index: number; segment: string }>;
      };
    }
  ).Segmenter;
  if (!SegmenterCtor) return 0;
  try {
    const segmenter = new SegmenterCtor("zh", { granularity: "word" });
    let end = 0;
    for (const part of segmenter.segment(text)) {
      const nextEnd = part.index + part.segment.length;
      if (nextEnd > maxLength) break;
      end = nextEnd;
    }
    return end;
  } catch {
    return 0;
  }
}

function releaseLengthFor(pending: string): number {
  if (!pending) return 0;
  if (pending.length <= MIN_RELEASE_CHARS && !BOUNDARY_PATTERN.test(pending)) return pending.length;

  const limited = pending.slice(0, Math.min(pending.length, MAX_RELEASE_CHARS));
  for (let index = Math.max(MIN_RELEASE_CHARS - 1, 0); index < limited.length; index += 1) {
    if (BOUNDARY_PATTERN.test(limited[index] || "")) return index + 1;
  }

  const segmented = segmentWithIntl(pending, Math.min(pending.length, MAX_RELEASE_CHARS));
  if (segmented >= MIN_RELEASE_CHARS) return segmented;
  if (pending.length > HARD_RELEASE_CHARS) return Math.min(pending.length, HARD_RELEASE_CHARS);
  return Math.min(pending.length, MAX_RELEASE_CHARS);
}

export function useSmoothAssistantStream({ onDisplayText }: SmoothStreamOptions) {
  const onDisplayTextRef = useRef(onDisplayText);
  const rawTextRef = useRef("");
  const displayTextRef = useRef("");
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    onDisplayTextRef.current = onDisplayText;
  }, [onDisplayText]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const emitDisplay = useCallback((text: string) => {
    displayTextRef.current = text;
    onDisplayTextRef.current(text);
  }, []);

  const drain = useCallback(() => {
    timerRef.current = undefined;
    const rawText = rawTextRef.current;
    const pending = rawText.slice(displayTextRef.current.length);
    if (!pending) return;

    const releaseLength = releaseLengthFor(pending);
    const nextText = rawText.slice(0, displayTextRef.current.length + releaseLength);
    emitDisplay(nextText);

    if (nextText.length < rawTextRef.current.length) {
      timerRef.current = window.setTimeout(drain, STREAM_TICK_MS);
    }
  }, [emitDisplay]);

  const schedule = useCallback(() => {
    if (timerRef.current !== undefined) return;
    timerRef.current = window.setTimeout(drain, STREAM_TICK_MS);
  }, [drain]);

  const reset = useCallback(() => {
    clearTimer();
    rawTextRef.current = "";
    displayTextRef.current = "";
  }, [clearTimer]);

  const append = useCallback(
    (delta: string) => {
      if (!delta) return;
      rawTextRef.current += delta;
      if (timerRef.current === undefined) {
        drain();
        return;
      }
      schedule();
    },
    [drain, schedule],
  );

  const replace = useCallback(
    (text: string) => {
      clearTimer();
      rawTextRef.current = text;
      displayTextRef.current = "";
      emitDisplay("");
      schedule();
    },
    [clearTimer, emitDisplay, schedule],
  );

  const flush = useCallback(
    (text?: string) => {
      clearTimer();
      if (typeof text === "string") rawTextRef.current = text;
      emitDisplay(rawTextRef.current);
      return rawTextRef.current;
    },
    [clearTimer, emitDisplay],
  );

  const stop = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  useEffect(() => stop, [stop]);

  return { append, flush, replace, reset, stop };
}
