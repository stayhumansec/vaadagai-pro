// WhatsApp has no public API to push a message into a chat programmatically.
// The Web Share API is the only way to hand it an image directly (it lands
// as one photo message with `text` as the caption) on supporting mobile
// browsers. Browsers that can't share files (mainly desktop) fall back to
// downloading the image and opening a wa.me chat with the text pre-filled,
// since wa.me links only ever support text, never attachments.
export async function shareImageViaWhatsApp(
  canvas: HTMLCanvasElement,
  filename: string,
  text: string,
  phone?: string | null
): Promise<'shared' | 'fallback' | 'cancelled'> {
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('canvas.toBlob failed');
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
      throw err;
    }
  }

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
  const waUrl = phone
    ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank', 'noreferrer');
  return 'fallback';
}
