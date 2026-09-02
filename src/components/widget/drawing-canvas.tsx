"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Tool = "pencil" | "line" | "rect" | "ellipse" | "eraser";

const W = 680;
const H = 460;
const COLORS = ["#1e293b", "#2563eb", "#dc2626", "#059669", "#d97706", "#ffffff"];

export function DrawingCanvas({
  brandColor,
  onSave,
  onCancel,
}: {
  brandColor: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const drawingRef = useRef(false);
  const undoStack = useRef<ImageData[]>([]);

  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(4);

  const resetWhite = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    resetWhite(ctx);
    ctxRef.current = ctx;
  }, [resetWhite]);

  function pushUndo() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, W, H));
    if (undoStack.current.length > 25) undoStack.current.shift();
  }

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    pushUndo();
    const p = pos(e);
    startRef.current = p;
    drawingRef.current = true;
    snapshotRef.current = ctx.getImageData(0, 0, W, H);

    ctx.lineWidth = tool === "eraser" ? size * 4 : size;
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    if (tool === "pencil" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = ctxRef.current;
    if (!ctx || !drawingRef.current || !startRef.current) return;
    const p = pos(e);
    const s = startRef.current;

    if (tool === "pencil" || tool === "eraser") {
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      return;
    }
    // shape preview: restore, then draw
    if (snapshotRef.current) ctx.putImageData(snapshotRef.current, 0, 0);
    ctx.lineWidth = size;
    ctx.strokeStyle = color;
    ctx.beginPath();
    if (tool === "line") {
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(p.x, p.y);
    } else if (tool === "rect") {
      ctx.rect(Math.min(s.x, p.x), Math.min(s.y, p.y), Math.abs(p.x - s.x), Math.abs(p.y - s.y));
    } else if (tool === "ellipse") {
      ctx.ellipse(
        (s.x + p.x) / 2,
        (s.y + p.y) / 2,
        Math.abs(p.x - s.x) / 2,
        Math.abs(p.y - s.y) / 2,
        0,
        0,
        Math.PI * 2,
      );
    }
    ctx.stroke();
  }

  function up() {
    drawingRef.current = false;
    startRef.current = null;
  }

  function undo() {
    const ctx = ctxRef.current;
    const prev = undoStack.current.pop();
    if (ctx && prev) ctx.putImageData(prev, 0, 0);
  }

  function clear() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    pushUndo();
    resetWhite(ctx);
  }

  const tools: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: "pencil", label: "Pencil", icon: <IconPencil /> },
    { id: "line", label: "Line", icon: <IconLine /> },
    { id: "rect", label: "Rectangle", icon: <IconRect /> },
    { id: "ellipse", label: "Ellipse", icon: <IconEllipse /> },
    { id: "eraser", label: "Eraser", icon: <IconEraser /> },
  ];

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-[var(--color-border)]">
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-label={t.label}
              aria-pressed={tool === t.id}
              onClick={() => setTool(t.id)}
              className={cn(
                "grid h-8 w-8 place-items-center text-[var(--color-foreground)] transition-colors cursor-pointer",
                tool === t.id ? "text-white" : "hover:bg-[var(--color-muted)]",
              )}
              style={tool === t.id ? { background: brandColor } : undefined}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              onClick={() => setColor(c)}
              className={cn(
                "h-6 w-6 rounded-full border cursor-pointer",
                color === c ? "ring-2 ring-offset-1 ring-[var(--color-ring)]" : "border-[var(--color-input)]",
              )}
              style={{ background: c }}
            />
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
          Size
          <input
            type="range"
            min={2}
            max={20}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-20 cursor-pointer accent-[var(--brand)]"
          />
        </label>

        <button
          type="button"
          onClick={undo}
          className="rounded-md border border-[var(--color-input)] px-2 py-1 text-xs font-semibold hover:bg-[var(--color-muted)] cursor-pointer"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-[var(--color-input)] px-2 py-1 text-xs font-semibold hover:bg-[var(--color-muted)] cursor-pointer"
        >
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        className="w-full touch-none rounded-md border border-[var(--color-border)]"
        style={{ aspectRatio: `${W} / ${H}`, cursor: "crosshair" }}
      />

      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          style={{ background: brandColor }}
          className="text-white"
          onClick={() => {
            const url = canvasRef.current?.toDataURL("image/png");
            if (url) onSave(url);
          }}
        >
          Attach sketch
        </Button>
      </div>
    </div>
  );
}

// ── tiny inline tool icons ──────────────────────────────────────────────────
const s = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IconPencil = () => (
  <svg {...s}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
const IconLine = () => <svg {...s}><path d="M5 19 19 5" /></svg>;
const IconRect = () => <svg {...s}><rect x="4" y="6" width="16" height="12" rx="1" /></svg>;
const IconEllipse = () => <svg {...s}><ellipse cx="12" cy="12" rx="8" ry="6" /></svg>;
const IconEraser = () => (
  <svg {...s}><path d="m7 21-4-4 11-11 4 4-7 7Z" /><path d="M18 13 9 4" /><path d="M15 21H8" /></svg>
);
