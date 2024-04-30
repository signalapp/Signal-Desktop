import { isEmpty } from 'lodash';
import { createRoot } from 'react-dom/client';
import { SessionQRCode, SessionQRCodeProps } from '../components/SessionQRCode';
import { sleepFor } from '../session/utils/Promise';
import { saveURLAsFile } from './saveURLAsFile';

export async function saveQRCode(id: string, customProps?: SessionQRCodeProps): Promise<void> {
  let qrCanvas: HTMLCanvasElement | undefined;

  if (!isEmpty(customProps)) {
    const root = document.querySelector('#root');
    const divElement = document.createElement('div');
    root?.appendChild(divElement);
    const reactRoot = createRoot(divElement!);
    reactRoot.render(<SessionQRCode {...customProps} />);
    // wait for it to render
    await sleepFor(100);
    qrCanvas = root?.querySelector(`#${customProps.id}`) as HTMLCanvasElement;
    reactRoot?.unmount();
    root?.removeChild(divElement);
  } else {
    qrCanvas = document.querySelector(`#${id}`) as HTMLCanvasElement;
  }

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
