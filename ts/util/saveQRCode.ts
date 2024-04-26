import { saveURLAsFile } from './saveURLAsFile';

export function saveQRCode(id: string): void {
  const qrCanvas = document.querySelector(`#${id}`) as HTMLCanvasElement;
  if (qrCanvas) {
    saveURLAsFile({
      filename: `${id}-${new Date().toISOString()}.png`,
      url: qrCanvas.toDataURL(),
      document,
    });
  } else {
    window.log.error('[saveQRCode] QR code not found!');
  }
}
