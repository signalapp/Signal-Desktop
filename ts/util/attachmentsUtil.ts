import { StagedAttachmentType } from '../components/session/conversation/SessionCompositionBox';
import { SignalService } from '../protobuf';

export interface MaxScaleSize {
  maxSize: number;
  maxHeight: number;
  maxWidth: number;
}

export async function autoScale<
  T extends { contentType: string; file: any; maxMeasurements?: MaxScaleSize }
>(attachment: T): Promise<T> {
  const { contentType, file, maxMeasurements } = attachment;
  if (contentType.split('/')[0] !== 'image' || contentType === 'image/tiff') {
    // nothing to do
    return Promise.resolve(attachment);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.onerror = reject;
    img.onload = () => {
      URL.revokeObjectURL(url);

      const maxSize = maxMeasurements?.maxSize || 6000 * 1024;
      const maxHeight = maxMeasurements?.maxHeight || 4096;
      const maxWidth = maxMeasurements?.maxWidth || 4096;

      if (
        img.naturalWidth <= maxWidth &&
        img.naturalHeight <= maxHeight &&
        file.size <= maxSize
      ) {
        resolve(attachment);
        return;
      }

      const gifMaxSize = 25000 * 1024;
      if (file.type === 'image/gif' && file.size <= gifMaxSize) {
        resolve(attachment);
        return;
      }

      if (file.type === 'image/gif') {
        reject(new Error('GIF is too large'));
        return;
      }

      const canvas = window.loadImage.scale(img, {
        canvas: true,
        maxWidth,
        maxHeight,
      });

      let quality = 0.95;
      let i = 4;
      let blob;
      do {
        i -= 1;
        blob = window.dataURLToBlobSync(
          canvas.toDataURL('image/jpeg', quality)
        );
        quality = (quality * maxSize) / blob.size;
        // NOTE: During testing with a large image, we observed the
        // `quality` value being > 1. Should we clamp it to [0.5, 1.0]?
        // See: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob#Syntax
        if (quality < 0.5) {
          quality = 0.5;
        }
      } while (i > 0 && blob.size > maxSize);

      resolve({
        ...attachment,
        file: blob,
      });
    };
    img.src = url;
  });
}

export async function getFile(attachment: StagedAttachmentType) {
  if (!attachment) {
    return Promise.resolve();
  }

  const attachmentFlags = attachment.isVoiceMessage
    ? SignalService.AttachmentPointer.Flags.VOICE_MESSAGE
    : null;

  const scaled = await autoScale(attachment);
  const fileRead = await readFile(scaled);
  return {
    ...fileRead,
    url: undefined,
    flags: attachmentFlags || null,
  };
}

export async function readFile(attachment: any): Promise<object> {
  return new Promise((resolve, reject) => {
    const FR = new FileReader();
    FR.onload = e => {
      const data = e?.target?.result as ArrayBuffer;
      resolve({
        ...attachment,
        data,
        size: data.byteLength,
      });
    };
    FR.onerror = reject;
    FR.onabort = reject;
    FR.readAsArrayBuffer(attachment.file);
  });
}
