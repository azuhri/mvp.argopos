import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crop, Loader2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  calculateCropSourceRect,
  clampCropOffset,
  createCroppedProductImage,
  type CropOffset,
  type ImageDimensions,
} from "@/lib/productImageCrop";

interface ProductImageCropDialogProps {
  file: File | null;
  open: boolean;
  current?: number;
  total?: number;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  offset: CropOffset;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

export function ProductImageCropDialog({
  file,
  open,
  current = 1,
  total = 1,
  onCancel,
  onConfirm,
}: ProductImageCropDialogProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [viewportSize, setViewportSize] = useState(0);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setSourceUrl("");
      return;
    }

    const nextSourceUrl = URL.createObjectURL(file);
    setSourceUrl(nextSourceUrl);
    setDimensions(null);
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    setError("");

    return () => URL.revokeObjectURL(nextSourceUrl);
  }, [file]);

  const setViewportNode = useCallback((viewport: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    viewportRef.current = viewport;

    if (!viewport) {
      setViewportSize(0);
      return;
    }

    const updateViewportSize = () => setViewportSize(viewport.clientWidth);
    updateViewportSize();

    const resizeObserver = new ResizeObserver(updateViewportSize);
    resizeObserver.observe(viewport);
    resizeObserverRef.current = resizeObserver;
  }, []);

  useEffect(
    () => () => resizeObserverRef.current?.disconnect(),
    [],
  );

  const baseRenderSize = useMemo(() => {
    if (!dimensions || !viewportSize) return null;

    const baseScale = Math.max(
      viewportSize / dimensions.width,
      viewportSize / dimensions.height,
    );
    return {
      width: dimensions.width * baseScale,
      height: dimensions.height * baseScale,
    };
  }, [dimensions, viewportSize]);

  const updateZoom = (nextZoom: number) => {
    const normalizedZoom = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM);
    setZoom(normalizedZoom);

    if (dimensions && viewportSize) {
      setOffset((currentOffset) =>
        clampCropOffset(currentOffset, dimensions, viewportSize, normalizedZoom),
      );
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dimensions || !viewportSize || isProcessing) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !dimensions || !viewportSize) {
      return;
    }

    setOffset(
      clampCropOffset(
        {
          x: drag.offset.x + event.clientX - drag.startX,
          y: drag.offset.y + event.clientY - drag.startY,
        },
        dimensions,
        viewportSize,
        zoom,
      ),
    );
  };

  const finishPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const handleReset = () => {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
  };

  const handleConfirm = async () => {
    if (!file || !sourceUrl || !dimensions || !viewportSize) return;

    setIsProcessing(true);
    setError("");

    try {
      const crop = calculateCropSourceRect(dimensions, viewportSize, zoom, offset);
      const croppedFile = await createCroppedProductImage({
        sourceUrl,
        sourceName: file.name,
        crop,
      });
      await onConfirm(croppedFile);
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "Gagal memproses gambar");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isProcessing) onCancel();
      }}
    >
      <DialogContent className="max-h-[95vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Atur gambar produk</DialogTitle>
            {total > 1 && (
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {current} dari {total}
              </span>
            )}
          </div>
          <DialogDescription>Rasio 1:1, hasil akhir JPEG 1200 x 1200 px</DialogDescription>
        </DialogHeader>

        <div
          ref={setViewportNode}
          className="relative mx-auto aspect-square w-full max-w-[420px] touch-none cursor-grab overflow-hidden rounded-lg bg-[#111827] active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          data-testid="product-image-crop-viewport"
        >
          {sourceUrl && (
            <img
              src={sourceUrl}
              alt={`Crop ${file?.name ?? "gambar produk"}`}
              draggable={false}
              onLoad={(event) => {
                setDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
              onError={() => setError("Gambar tidak dapat dibaca")}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={
                baseRenderSize
                  ? {
                      width: baseRenderSize.width,
                      height: baseRenderSize.height,
                      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    }
                  : undefined
              }
            />
          )}

          {!dimensions && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="h-6 w-6 animate-spin" aria-label="Memuat gambar" />
            </div>
          )}

          <div aria-hidden="true" className="pointer-events-none absolute inset-0 border border-white/70" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/35" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-1/3 border-r border-white/35" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/35" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-1/3 border-b border-white/35" />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => updateZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM || isProcessing}
            aria-label="Perkecil gambar"
            title="Perkecil gambar"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Slider
            value={[zoom]}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            onValueChange={([value]) => updateZoom(value)}
            disabled={!dimensions || isProcessing}
            aria-label="Zoom gambar"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => updateZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM || isProcessing}
            aria-label="Perbesar gambar"
            title="Perbesar gambar"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleReset}
            disabled={isProcessing}
            aria-label="Reset crop"
            title="Reset crop"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!dimensions || !viewportSize || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Crop className="mr-2 h-4 w-4" />
                Terapkan crop
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
