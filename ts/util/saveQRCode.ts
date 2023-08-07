import { saveURLAsFile } from './saveURLAsFile';

export function saveQRCode(
  filename: string,
  width: string,
  height: string,
  backgroundColor: string,
  foregroundColor: string
): void {
  const qrSVG = document.querySelector('.qr-image svg');
  if (qrSVG) {
    qrSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    qrSVG.setAttribute('width', width);
    qrSVG.setAttribute('height', height);
    let content = qrSVG.outerHTML;
    content = content.replaceAll(backgroundColor, 'white');
    content = content.replaceAll(foregroundColor, 'black');
    const file = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(file);
    saveURLAsFile({
      filename: `${filename}-${new Date().toISOString()}.svg`,
      url,
      document,
    });
  } else {
    window.log.info('[saveQRCode] QR code not found');
  }
}
