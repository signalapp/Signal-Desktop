/* eslint-disable more/no-then */
/* global document, URL, Blob */

import { blobToArrayBuffer, dataURLToBlob } from 'blob-util';
import moment from 'moment';
import { toLogFormat } from './Errors';

import {
  getDecryptedBlob,
  getDecryptedMediaUrl,
} from '../../session/crypto/DecryptedAttachmentsManager';
import { ToastUtils } from '../../session/utils';
import { GoogleChrome } from '../../util';
import { autoScaleForAvatar, autoScaleForThumbnail } from '../../util/attachmentsUtil';
import { isAudio } from '../MIME';

export const THUMBNAIL_SIDE = 200;
export const THUMBNAIL_CONTENT_TYPE = 'image/png';

export const urlToBlob = async (dataUrl: string) => {
  return (await fetch(dataUrl)).blob();
};

export const getImageDimensions = async ({
  objectUrl,
}: {
  objectUrl: string;
}): Promise<{ height: number; width: number }> =>
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  new Promise((resolve, reject) => {
    const image = document.createElement('img');

    image.addEventListener('load', () => {
      resolve({
        height: image.naturalHeight,
        width: image.naturalWidth,
      });
    });
    image.addEventListener('error', error => {
      window.log.error('getImageDimensions error', toLogFormat(error));
      reject(error);
    });
    // image/jpg is hard coded here but does not look to cause any issues
    void getDecryptedMediaUrl(objectUrl, 'image/jpg', false)
      .then(decryptedUrl => {
        image.src = decryptedUrl;
      })
      // eslint-disable-next-line no-console
      .catch(console.error);
  });

export const makeImageThumbnailBuffer = async ({
  objectUrl,
  contentType,
}: {
  objectUrl: string;
  contentType: string;
}) => {
  if (!GoogleChrome.isImageTypeSupported(contentType)) {
    throw new Error(
      'makeImageThumbnailBuffer can only be called with what GoogleChrome image type supports'
    );
  }
  const decryptedBlob = await getDecryptedBlob(objectUrl, contentType);
  const scaled = await autoScaleForThumbnail({ contentType, blob: decryptedBlob });

  return blobToArrayBuffer(scaled.blob);
};

export const makeVideoScreenshot = async ({
  objectUrl,
  contentType = 'image/png',
}: {
  objectUrl: string;
  contentType: string | undefined;
}) =>
  new Promise<Blob>((resolve, reject) => {
    const video = document.createElement('video');

    function capture() {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctxCanvas = canvas.getContext('2d');
      if (!ctxCanvas) {
        throw new Error('Failed to get a 2d context for canvas of video in capture()');
      }
      ctxCanvas.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = dataURLToBlob(canvas.toDataURL(contentType));

      video.removeEventListener('canplay', capture);
      video.pause();
      video.currentTime = 0;
      resolve(blob);
    }

    video.addEventListener('canplay', capture);
    video.addEventListener('error', error => {
      window.log.error('makeVideoScreenshot error', toLogFormat(error));
      reject(error);
    });

    void getDecryptedMediaUrl(objectUrl, contentType, false).then(decryptedUrl => {
      video.src = decryptedUrl;
      video.muted = true;
      void video.play(); // for some reason, this is to be started, otherwise the generated thumbnail will be empty
    });
  });

export async function getVideoDuration({
  objectUrl,
  contentType,
}: {
  objectUrl: string;
  contentType: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');

    video.addEventListener('loadedmetadata', () => {
      const duration = moment.duration(video.duration, 'seconds');
      const durationString = moment.utc(duration.asMilliseconds()).format('m:ss');
      resolve(durationString);
    });

    video.addEventListener('error', error => {
      reject(error);
    });

    void getDecryptedMediaUrl(objectUrl, contentType, false)
      .then(decryptedUrl => {
        video.src = decryptedUrl;
      })
      .catch(err => {
        reject(err);
      });
  });
}

export async function getAudioDuration({
  objectUrl,
  contentType,
}: {
  objectUrl: string;
  contentType: string;
}): Promise<string> {
  if (!isAudio(contentType)) {
    throw new Error('getAudioDuration can only be called with audio content type');
  }

  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');

    audio.addEventListener('loadedmetadata', () => {
      const duration = moment.duration(audio.duration, 'seconds');
      const durationString = moment.utc(duration.asMilliseconds()).format('m:ss');
      resolve(durationString);
    });

    audio.addEventListener('error', error => {
      reject(error);
    });

    void getDecryptedMediaUrl(objectUrl, contentType, false)
      .then(decryptedUrl => {
        audio.src = decryptedUrl;
      })
      .catch(err => {
        reject(err);
      });
  });
}

export const makeObjectUrl = (data: ArrayBufferLike, contentType: string) => {
  const blob = new Blob([data], {
    type: contentType,
  });

  return URL.createObjectURL(blob);
};

export const revokeObjectUrl = (objectUrl: string) => {
  URL.revokeObjectURL(objectUrl);
};

export async function autoScaleAvatarBlob(file: File) {
  try {
    const scaled = await autoScaleForAvatar({ blob: file, contentType: file.type });

    const url = window.URL.createObjectURL(scaled.blob);

    return url;
  } catch (e) {
    ToastUtils.pushToastError(
      'pickFileForAvatar',
      'An error happened while picking/resizing the image',
      e.message || ''
    );
    window.log.error(e);
    return null;
  }
}

/**
 * Shows the system file picker for images, scale the image down for avatar/opengroup measurements and return the blob objectURL on success
 */
export async function pickFileForAvatar(): Promise<string | null> {
  if (window.sessionFeatureFlags.integrationTestEnv) {
    window.log.info(
      'shorting pickFileForAvatar as it does not work in playwright/notsending the filechooser event'
    );

    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('we need a context');
    }
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        const file = new File([blob as Blob], 'image.png', { type: 'image/png' });
        void autoScaleAvatarBlob(file)
          .then(url => resolve(url))
          // eslint-disable-next-line no-console
          .catch(console.error);
      });
    });
  }
  const [fileHandle] = await (window as any).showOpenFilePicker({
    types: [
      {
        description: 'Images',
        accept: {
          'image/*': ['.png', '.gif', '.jpeg', '.jpg'],
        },
      },
    ],
    excludeAcceptAllOption: true,
    multiple: false,
  });

  const file = (await fileHandle.getFile()) as File;
  return autoScaleAvatarBlob(file);
}
