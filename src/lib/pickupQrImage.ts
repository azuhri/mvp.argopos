/** Rasterize the locally rendered QR, preserving its white four-module margin. */
export async function createPickupQrPng(svg: SVGSVGElement): Promise<string> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", "1024");
  copy.setAttribute("height", "1024");
  copy.removeAttribute("class");
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("QR belum dapat disimpan sebagai gambar. Silakan coba lagi."));
  });
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browser belum mendukung unduhan gambar QR.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const png = canvas.toDataURL("image/png");
  if (!png.startsWith("data:image/png;base64,")) throw new Error("QR belum dapat disimpan sebagai gambar. Silakan coba lagi.");
  return png;
}

export function pickupQrFilename(transactionId: string): string {
  const safeId = transactionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "pesanan";
  return `qr-penyerahan-${safeId}.png`;
}
