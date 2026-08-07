export const PRODUCT_IMAGE_OUTPUT_SIZE = 1200;
export const PRODUCT_IMAGE_OUTPUT_TYPE = "image/jpeg";
export const PRODUCT_IMAGE_OUTPUT_QUALITY = 0.9;
export const PRODUCT_MAIN_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PRODUCT_COLLECTION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_COLLECTION_BATCH_MAX_BYTES = 20 * 1024 * 1024;

const SUPPORTED_PRODUCT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface CropOffset {
  x: number;
  y: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface CropSourceRect {
  x: number;
  y: number;
  size: number;
}

interface CreateCroppedProductImageOptions {
  sourceUrl: string;
  sourceName: string;
  crop: CropSourceRect;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const assertCropGeometry = (
  dimensions: ImageDimensions,
  viewportSize: number,
  zoom: number,
) => {
  if (
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    viewportSize <= 0 ||
    zoom < 1
  ) {
    throw new Error("Crop geometry is invalid");
  }
};

export const getProductImageValidationError = (file: File, maxBytes: number) => {
  if (!SUPPORTED_PRODUCT_IMAGE_TYPES.has(file.type.toLowerCase())) {
    return "Gunakan file JPEG, PNG, atau WebP";
  }

  if (file.size <= 0) {
    return "File gambar kosong atau tidak dapat dibaca";
  }

  if (file.size > maxBytes) {
    return `Ukuran ${file.name} melebihi batas ${Math.round(maxBytes / 1024 / 1024)} MB`;
  }

  return null;
};

export const getCropOffsetBounds = (
  dimensions: ImageDimensions,
  viewportSize: number,
  zoom: number,
): CropOffset => {
  assertCropGeometry(dimensions, viewportSize, zoom);

  const baseScale = Math.max(
    viewportSize / dimensions.width,
    viewportSize / dimensions.height,
  );
  const renderedWidth = dimensions.width * baseScale * zoom;
  const renderedHeight = dimensions.height * baseScale * zoom;

  return {
    x: Math.max(0, (renderedWidth - viewportSize) / 2),
    y: Math.max(0, (renderedHeight - viewportSize) / 2),
  };
};

export const clampCropOffset = (
  offset: CropOffset,
  dimensions: ImageDimensions,
  viewportSize: number,
  zoom: number,
): CropOffset => {
  const bounds = getCropOffsetBounds(dimensions, viewportSize, zoom);

  return {
    x: clamp(offset.x, -bounds.x, bounds.x),
    y: clamp(offset.y, -bounds.y, bounds.y),
  };
};

export const calculateCropSourceRect = (
  dimensions: ImageDimensions,
  viewportSize: number,
  zoom: number,
  offset: CropOffset,
): CropSourceRect => {
  assertCropGeometry(dimensions, viewportSize, zoom);

  const baseScale = Math.max(
    viewportSize / dimensions.width,
    viewportSize / dimensions.height,
  );
  const effectiveScale = baseScale * zoom;
  const cropSize = viewportSize / effectiveScale;
  const clampedOffset = clampCropOffset(offset, dimensions, viewportSize, zoom);

  return {
    x: clamp(
      dimensions.width / 2 - clampedOffset.x / effectiveScale - cropSize / 2,
      0,
      dimensions.width - cropSize,
    ),
    y: clamp(
      dimensions.height / 2 - clampedOffset.y / effectiveScale - cropSize / 2,
      0,
      dimensions.height - cropSize,
    ),
    size: cropSize,
  };
};

export const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca hasil crop"));
    reader.readAsDataURL(file);
  });

const loadImage = (sourceUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gambar tidak dapat diproses"));
    image.src = sourceUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Browser gagal menghasilkan file crop"));
      },
      PRODUCT_IMAGE_OUTPUT_TYPE,
      PRODUCT_IMAGE_OUTPUT_QUALITY,
    );
  });

const getCroppedFileName = (sourceName: string) => {
  const baseName = sourceName.replace(/\.[^/.]+$/, "").trim() || "product";
  return `${baseName}-1200x1200.jpg`;
};

export const createCroppedProductImage = async ({
  sourceUrl,
  sourceName,
  crop,
}: CreateCroppedProductImageOptions) => {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = PRODUCT_IMAGE_OUTPUT_SIZE;
  canvas.height = PRODUCT_IMAGE_OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Browser tidak mendukung pemrosesan gambar");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.size,
    crop.size,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await canvasToBlob(canvas);
  return new File([blob], getCroppedFileName(sourceName), {
    type: PRODUCT_IMAGE_OUTPUT_TYPE,
    lastModified: Date.now(),
  });
};
