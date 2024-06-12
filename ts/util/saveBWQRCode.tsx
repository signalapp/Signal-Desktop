import { createRoot } from 'react-dom/client';
import { SessionQRCode, SessionQRCodeProps } from '../components/SessionQRCode';
import { convertIconToImageURL } from '../hooks/useIconToImageURL';
import { sleepFor } from '../session/utils/Promise';
import { saveURLAsFile } from './saveURLAsFile';

export async function saveBWQRCode(filename: string, props: SessionQRCodeProps): Promise<void> {
  try {
    const root = document.querySelector('#root');
    const divElement = document.createElement('div');
    divElement.style.display = 'none';
    root?.appendChild(divElement);

    let logoImage = props.logoImage;

    if (props.hasLogo) {
      const { dataUrl } = await convertIconToImageURL(props.hasLogo);
      logoImage = dataUrl;
    }

    const reactRoot = createRoot(divElement!);
    reactRoot.render(
      <SessionQRCode
        id={props.id}
        value={props.value}
        size={props.size}
        hasLogo={props.hasLogo}
        logoImage={logoImage}
        logoSize={props.logoSize}
      />
    );
    // wait for it to render
    await sleepFor(100);

    const qrCanvas = root?.querySelector(`#${props.id}-canvas`);
    if (qrCanvas) {
      const url = (qrCanvas as HTMLCanvasElement).toDataURL('image/jpeg');
      if (url) {
        saveURLAsFile({
          filename,
          url,
          document,
        });
      }
    } else {
      throw Error('QR Code canvas not found');
    }

    reactRoot?.unmount();
    root?.removeChild(divElement);
  } catch (err) {
    window.log.error('WIP: [saveBWQRCode] failed', err);
  }
}
