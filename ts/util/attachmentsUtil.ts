/* eslint-disable max-len */
import imageType from 'image-type';

import { arrayBufferToBlob } from 'blob-util';
import loadImage from 'blueimp-load-image';
import fileSize from 'filesize';
import { StagedAttachmentType } from '../components/conversation/composition/CompositionBox';
import { SignalService } from '../protobuf';
import { getDecryptedMediaUrl } from '../session/crypto/DecryptedAttachmentsManager';
import { sendDataExtractionNotification } from '../session/messages/outgoing/controlMessage/DataExtractionNotificationMessage';
import { AttachmentType, save } from '../types/Attachment';
import { IMAGE_GIF, IMAGE_JPEG, IMAGE_PNG, IMAGE_TIFF, IMAGE_UNKNOWN } from '../types/MIME';
import { getAbsoluteAttachmentPath, processNewAttachment } from '../types/MessageAttachment';
import { THUMBNAIL_SIDE } from '../types/attachments/VisualAttachment';

import { FILESIZE, MAX_ATTACHMENT_FILESIZE_BYTES } from '../session/constants';
import { perfEnd, perfStart } from '../session/utils/Performance';

/**
 * The logic for sending attachments is as follow:
 *
 * 1. The User selects whatever attachments he wants to send with the system file handler.
 * 2. We generate a preview if possible just to use it in the Composition Box Staged attachments list (preview of attachments scheduled for sending with the next message)
 * 3. During that preview generation, we also autoscale images if possible and make sure the orientation is right.
 * 4. If autoscale is not possible, we make sure the size of each attachments is fine with the service nodes limit. Otherwise, a toast is shown and the attachment is not added.
 * 5. When autoscale is possible, we make sure that the scaled size is OK for the services nodes already
 * 6. We do not keep those autoscaled attachments in memory for now, just the previews are kept in memory and the original filepath.
 *
 * 7. Once the user is ready to send a message and hit ENTER or SEND, we grab the real files again from the staged attachments, autoscale them again if possible, generate thumbnails and screenshot (video) if needed and write them to the attachments folder (encrypting them) with processNewAttachments.
 *
 * 8. This operation will give us back the path of the attachment in the attachments folder and the size written for this attachment (make sure to use that one as size for the outgoing attachment)
 *
 * 9. Once all attachments are written to the attachments folder, we grab the data from those files directly before sending them. This is done in uploadData() with loadAttachmentsData().
 *
 * 10. We use the grabbed data for upload of the attachments, get an url for each of them and send the url with the attachments details to the user/opengroup/closed group
 */
const DEBUG_ATTACHMENTS_SCALE = false;
export interface MaxScaleSize {
  maxSize?: number;
  maxHeight?: number;
  maxWidth?: number;
  maxSide?: number; // use this to make avatars cropped if too big and centered if too small.
}

export const ATTACHMENT_DEFAULT_MAX_SIDE = 4096;

export const AVATAR_MAX_SIDE = 640;

/**
 * Resize a jpg/gif/png file to our definition on an avatar before upload
 */
export async function autoScaleForAvatar<T extends { contentType: string; blob: Blob }>(
  attachment: T
) {
  const maxMeasurements = {
    maxSide: AVATAR_MAX_SIDE,
    maxSize: 5 * FILESIZE.MB,
  };

  // we can only upload jpeg, gif, or png as avatar/opengroup

  if (
    attachment.contentType !== IMAGE_PNG &&
    attachment.contentType !== IMAGE_GIF &&
    attachment.contentType !== IMAGE_JPEG
  ) {
    // nothing to do
    throw new Error('Cannot autoScaleForAvatar another file than PNG, GIF or JPEG.');
  }

  if (DEBUG_ATTACHMENTS_SCALE) {
    window.log.debug('autoscale for avatar', maxMeasurements);
  }
  return autoScale(attachment, maxMeasurements);
}

/**
 * Resize an avatar when we receive it, before saving it locally.
 */
export async function autoScaleForIncomingAvatar(incomingAvatar: ArrayBuffer) {
  const maxMeasurements = {
    maxSide: AVATAR_MAX_SIDE,
    maxSize: 5 * FILESIZE.MB,
  };

  // the avatar url send in a message does not contain anything related to the avatar MIME type, so
  // we use imageType to find the MIMEtype from the buffer itself

  const contentType = imageType(new Uint8Array(incomingAvatar))?.mime || IMAGE_UNKNOWN;
  const blob = arrayBufferToBlob(incomingAvatar, contentType);
  // we do not know how to resize an incoming gif avatar, so just keep it full sized.
  if (contentType === IMAGE_GIF) {
    return {
      contentType,
      blob,
    };
  }

  if (DEBUG_ATTACHMENTS_SCALE) {
    window.log.debug('autoscale for incoming avatar', maxMeasurements);
  }

  return autoScale(
    {
      blob,
      contentType,
    },
    maxMeasurements
  );
}

/**
 * Auto scale an attachment to get a thumbnail from it. We consider that a thumbnail is currently at most 200 ko, is a square and has a maxSize of THUMBNAIL_SIDE
 * @param attachment the attachment to auto scale
 */
export async function autoScaleForThumbnail<T extends { contentType: string; blob: Blob }>(
  attachment: T
) {
  const maxMeasurements = {
    maxSide: THUMBNAIL_SIDE,
    maxSize: 200 * 1000, // 200 ko
  };

  if (DEBUG_ATTACHMENTS_SCALE) {
    window.log.debug('autoScaleForThumbnail', maxMeasurements);
  }

  return autoScale(attachment, maxMeasurements);
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(
      blob => {
        resolve(blob);
      },
      type,
      quality
    );
  });
}

/**
 * Scale down an image to fit in the required dimension.
 * Note: This method won't crop if needed,
 * @param attachment The attachment to scale down
 * @param maxMeasurements any of those will be used if set
 */

export async function autoScale<T extends { contentType: string; blob: Blob }>(
  attachment: T,
  maxMeasurements?: MaxScaleSize
): Promise<{
  contentType: string;
  blob: Blob;
  width?: number;
  height?: number;
}> {
  const start = Date.now();
  const { contentType, blob } = attachment;
  if (contentType.split('/')[0] !== 'image' || contentType === IMAGE_TIFF) {
    // nothing to do
    return attachment;
  }

  if (maxMeasurements?.maxSide && (maxMeasurements?.maxHeight || maxMeasurements?.maxWidth)) {
    throw new Error('Cannot have maxSide and another dimension set together');
  }

  // Make sure the asked max size is not more than whatever
  // Services nodes can handle (MAX_ATTACHMENT_FILESIZE_BYTES)
  const askedMaxSize = maxMeasurements?.maxSize || MAX_ATTACHMENT_FILESIZE_BYTES;
  const maxSize =
    askedMaxSize > MAX_ATTACHMENT_FILESIZE_BYTES ? MAX_ATTACHMENT_FILESIZE_BYTES : askedMaxSize;
  const makeSquare = Boolean(maxMeasurements?.maxSide);
  const maxHeight =
    maxMeasurements?.maxHeight || maxMeasurements?.maxSide || ATTACHMENT_DEFAULT_MAX_SIDE;
  const maxWidth =
    maxMeasurements?.maxWidth || maxMeasurements?.maxSide || ATTACHMENT_DEFAULT_MAX_SIDE;

  if (blob.type === IMAGE_GIF && blob.size <= maxSize) {
    return attachment;
  }

  if (blob.type === IMAGE_GIF && blob.size > maxSize) {
    throw new Error(`GIF is too large. Max size: ${fileSize(maxSize, { base: 10, round: 0 })}`);
  }

  perfStart(`loadimage-*${blob.size}`);
  const canvasLoad = await loadImage(blob, {});
  const canvasScaled = loadImage.scale(
    canvasLoad.image, // img or canvas element
    {
      maxWidth: makeSquare ? maxMeasurements?.maxSide : maxWidth,
      maxHeight: makeSquare ? maxMeasurements?.maxSide : maxHeight,
      crop: !!makeSquare,
      cover: !!makeSquare,
      orientation: 1,
      canvas: true,
      imageSmoothingQuality: 'medium',
      meta: false,
    }
  );
  perfEnd(`loadimage-*${blob.size}`, `loadimage-*${blob.size}`);
  if (!canvasScaled || !canvasScaled.width || !canvasScaled.height) {
    throw new Error('failed to scale image');
  }

  let readAndResizedBlob = blob;

  if (
    canvasScaled.width <= maxWidth &&
    canvasScaled.height <= maxHeight &&
    blob.size <= maxSize &&
    !makeSquare
  ) {
    if (DEBUG_ATTACHMENTS_SCALE) {
      window.log.debug('canvasScaled used right away as width, height and size are fine', {
        canvasScaledWidth: canvasScaled.width,
        canvasScaledHeight: canvasScaled.height,
        maxWidth,
        maxHeight,
        blobsize: blob.size,
        maxSize,
        makeSquare,
      });
    }
    // the canvas has a size of whatever was given by the caller of autoscale().
    // so we have to return those measures as the loaded file has now those measures.
    return {
      blob,
      contentType: attachment.contentType,
      width: canvasScaled.width,
      height: canvasScaled.height,
    };
  }
  if (DEBUG_ATTACHMENTS_SCALE) {
    window.log.debug('canvasOri.originalWidth', {
      canvasOriginalWidth: canvasScaled.width,
      canvasOriginalHeight: canvasScaled.height,
      maxWidth,
      maxHeight,
      blobsize: blob.size,
      maxSize,
      makeSquare,
    });
  }
  let quality = 0.95;
  const startI = 4;
  let i = startI;
  do {
    i -= 1;
    if (DEBUG_ATTACHMENTS_SCALE) {
      window.log.debug(`autoscale iteration: [${i}] for:`, JSON.stringify(readAndResizedBlob.size));
    }
    // eslint-disable-next-line no-await-in-loop
    const tempBlob = await canvasToBlob(canvasScaled, 'image/jpeg', quality);

    if (!tempBlob) {
      throw new Error('Failed to get blob during canvasToBlob.');
    }
    readAndResizedBlob = tempBlob;
    quality = (quality * maxSize) / (readAndResizedBlob.size * (i === 1 ? 2 : 1)); // make the last iteration decrease drastically quality of the image

    if (quality > 1) {
      quality = 0.95;
    }
  } while (i > 0 && readAndResizedBlob.size > maxSize);

  if (readAndResizedBlob.size > maxSize) {
    throw new Error('Cannot add this attachment even after trying to scale it down.');
  }
  window.log.debug(`[perf] autoscale took ${Date.now() - start}ms `);

  return {
    contentType: attachment.contentType,
    blob: readAndResizedBlob,

    width: canvasScaled.width,
    height: canvasScaled.height,
  };
}

export type StagedAttachmentImportedType = Omit<
  StagedAttachmentType,
  'file' | 'url' | 'fileSize'
> & { flags?: number };

/**
 * This is the type of the image of a link preview once it was saved in the attachment folder
 */
export type StagedImagePreviewImportedType = Pick<
  StagedAttachmentType,
  'contentType' | 'path' | 'size' | 'width' | 'height'
>;

/**
 * This is the type of a complete preview imported in the app, hence with the image being a StagedImagePreviewImportedType.
 * This is the one to be used in uploadData and which should be saved in the database message models
 */
export type StagedPreviewImportedType = {
  url: string;
  title: string;
  image?: StagedImagePreviewImportedType;
};

export async function getFileAndStoreLocally(
  attachment: StagedAttachmentType
): Promise<StagedAttachmentImportedType | null> {
  if (!attachment) {
    return null;
  }

  const maxMeasurements: MaxScaleSize = {
    maxSize: MAX_ATTACHMENT_FILESIZE_BYTES,
  };

  const attachmentFlags = attachment.isVoiceMessage
    ? (SignalService.AttachmentPointer.Flags.VOICE_MESSAGE as number)
    : null;

  const blob: Blob = attachment.file;

  const scaled = await autoScale(
    {
      ...attachment,
      blob,
    },
    maxMeasurements
  );

  // this operation might change the file size, so be sure to rely on it on return here.
  const attachmentSavedLocally = await processNewAttachment({
    data: await scaled.blob.arrayBuffer(),
    contentType: attachment.contentType,
    fileName: attachment.fileName,
  });

  return {
    caption: attachment.caption,
    contentType: attachment.contentType,
    fileName: attachmentSavedLocally.fileName,
    path: attachmentSavedLocally.path,
    width: attachmentSavedLocally.width,
    height: attachmentSavedLocally.height,
    screenshot: attachmentSavedLocally.screenshot,
    thumbnail: attachmentSavedLocally.thumbnail,
    size: attachmentSavedLocally.size,
    flags: attachmentFlags || undefined,
  };
}

export async function getFileAndStoreLocallyImageBuffer(imageBuffer: ArrayBuffer) {
  if (!imageBuffer || !imageBuffer.byteLength) {
    return null;
  }

  const contentType = imageType(new Uint8Array(imageBuffer))?.mime || IMAGE_UNKNOWN;

  const blob = new Blob([imageBuffer], { type: contentType });

  const scaled = await autoScaleForThumbnail({
    contentType,
    blob,
  });

  // this operation might change the file size, so be sure to rely on it on return here.
  const attachmentSavedLocally = await processNewAttachment({
    data: await scaled.blob.arrayBuffer(),
    contentType: scaled.contentType,
  });

  return {
    contentType: scaled.contentType,
    path: attachmentSavedLocally.path,
    width: scaled.width,
    height: scaled.height,
    size: attachmentSavedLocally.size,
  };
}

export type AttachmentFileType = {
  attachment: any;
  data: ArrayBuffer;
  size: number;
};

export async function readAvatarAttachment(attachment: {
  file: Blob;
}): Promise<AttachmentFileType> {
  const dataReadFromBlob = await attachment.file.arrayBuffer();

  return { attachment, data: dataReadFromBlob, size: dataReadFromBlob.byteLength };
}

export const saveAttachmentToDisk = async ({
  attachment,
  messageTimestamp,
  messageSender,
  conversationId,
  index,
}: {
  attachment: AttachmentType;
  messageTimestamp: number;
  messageSender: string;
  conversationId: string;
  index: number;
}) => {
  const decryptedUrl = await getDecryptedMediaUrl(attachment.url, attachment.contentType, false);
  save({
    attachment: { ...attachment, url: decryptedUrl },
    document,
    getAbsolutePath: getAbsoluteAttachmentPath,
    timestamp: messageTimestamp,
    index,
  });
  await sendDataExtractionNotification(conversationId, messageSender, messageTimestamp);
};
