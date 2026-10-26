// Renders a shareable caption card (photo + bent glass plate) to a PNG, fully
// in the browser: no server work, no AI. Never import from server code.

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderCard(imageUrl: string, caption: string): Promise<Blob> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("image unavailable");
  const bitmap = await createImageBitmap(await response.blob());

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  ctx.fillStyle = "#fff7ee";
  ctx.fillRect(0, 0, W, H);

  // Photo: cover the top ~78% (exact corners: the user's reality is precise).
  const photoH = Math.round(H * 0.78);
  const scale = Math.max(W / bitmap.width, photoH / bitmap.height);
  const dw = bitmap.width * scale;
  const dh = bitmap.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, photoH);
  ctx.clip();
  ctx.drawImage(bitmap, (W - dw) / 2, (photoH - dh) / 2, dw, dh);
  ctx.restore();

  // The AI plate: stretched, sagging toward the bottom-right.
  ctx.font = "700 58px system-ui, -apple-system, 'Segoe UI', sans-serif";
  const padX = 56;
  const plateW = W - 120;
  const lines = wrap(ctx, caption, plateW - padX * 2 - 70).slice(0, 6);
  const lineH = 70;
  const plateH = Math.max(220, lines.length * lineH + 110);
  const plateX = 60;
  const plateY = Math.min(photoH - 80, H - plateH - 120);

  ctx.save();
  ctx.shadowColor = "rgba(60,30,10,0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#fff0e3";
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, [44, 44, 190, 44]);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,122,26,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, [44, 44, 190, 44]);
  ctx.stroke();

  ctx.fillStyle = "#1f1712";
  ctx.textBaseline = "top";
  lines.forEach((text, i) => ctx.fillText(text, plateX + padX, plateY + 52 + i * lineH));

  // Wordmark.
  ctx.font = "800 44px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#1f1712";
  const brand = "capti";
  ctx.fillText(brand, 60, H - 96);
  const bx = 60 + ctx.measureText(brand).width;
  ctx.save();
  ctx.translate(bx + 20, H - 96);
  ctx.scale(1.5, 1);
  ctx.fillStyle = "#c2410c";
  ctx.fillText("o", 0, 0);
  ctx.restore();
  ctx.fillStyle = "#1f1712";
  ctx.fillText("n", bx + 20 + ctx.measureText("o").width * 1.5, H - 96);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("render failed"))), "image/png"),
  );
}

export async function downloadCard(imageUrl: string, caption: string) {
  const blob = await renderCard(imageUrl, caption);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "caption-card.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
