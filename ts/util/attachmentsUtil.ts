import { SignalService } from '../protobuf';
import loadImage, { CropOptions, LoadImageOptions } from 'blueimp-load-image';
import { getDecryptedMediaUrl } from '../session/crypto/DecryptedAttachmentsManager';
import { sendDataExtractionNotification } from '../session/messages/outgoing/controlMessage/DataExtractionNotificationMessage';
import { AttachmentType, save } from '../types/Attachment';
import { StagedAttachmentType } from '../components/conversation/composition/CompositionBox';
import { getAbsoluteAttachmentPath, processNewAttachment } from '../types/MessageAttachment';
import { arrayBufferToBlob, dataURLToBlob } from 'blob-util';
import { IMAGE_GIF, IMAGE_JPEG, IMAGE_PNG, IMAGE_TIFF, IMAGE_UNKNOWN } from '../types/MIME';
import { THUMBNAIL_SIDE } from '../types/attachments/VisualAttachment';

import imageType from 'image-type';
import { MAX_ATTACHMENT_FILESIZE_BYTES } from '../session/constants';

export interface MaxScaleSize {
  maxSize?: number;
  maxHeight?: number;
  maxWidth?: number;
  maxSide?: number; // use this to make avatars cropped if too big and centered if too small.
}

export const ATTACHMENT_DEFAULT_MAX_SIDE = 4096;

/**
 * Resize a jpg/gif/png file to our definition on an avatar before upload
 */
export async function autoScaleForAvatar<T extends { contentType: string; blob: Blob }>(
  attachment: T
) {
  const maxMeasurements = {
    maxSide: 640,
    maxSize: 1000 * 1024,
  };

  // we can only upload jpeg, gif, or png as avatar/opengroup

  if (
    attachment.contentType !== IMAGE_PNG &&
    attachment.contentType !== IMAGE_GIF &&
    attachment.contentType !== IMAGE_JPEG
  ) {
    // nothing to do
    throw new Error('Cannot autoScaleForAvatar another file than PNG,GIF or JPEG.');
  }

  return autoScale(attachment, maxMeasurements);
}

/**
 * Resize an avatar when we receive it, before saving it locally.
 */
export async function autoScaleForIncomingAvatar(incomingAvatar: ArrayBuffer) {
  const maxMeasurements = {
    maxSide: 640,
    maxSize: 1000 * 1024,
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
  return autoScale(
    {
      blob,
      contentType,
    },
    maxMeasurements
  );
}

export async function autoScaleForThumbnail<T extends { contentType: string; blob: Blob }>(
  attachment: T
) {
  const maxMeasurements = {
    maxSide: THUMBNAIL_SIDE,
    maxSize: 200 * 1000, // 200 ko
  };

  return autoScale(attachment, maxMeasurements);
}

/**
 * Scale down an image to fit in the required dimension.
 * Note: This method won't crop if needed,
 * @param attachment The attachment to scale down
 * @param maxMeasurements any of those will be used if set
 */
// tslint:disable-next-line: cyclomatic-complexity
export async function autoScale<T extends { contentType: string; blob: Blob }>(
  attachment: T,
  maxMeasurements?: MaxScaleSize
): Promise<{
  contentType: string;
  blob: Blob;
  width?: number;
  height?: number;
}> {
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
    throw new Error(`GIF is too large, required size is ${maxSize}`);
  }

  const crop: CropOptions = {
    crop: makeSquare,
  };

  const loadImgOpts: LoadImageOptions = {
    maxWidth: makeSquare ? maxMeasurements?.maxSide : maxWidth,
    maxHeight: makeSquare ? maxMeasurements?.maxSide : maxHeight,
    ...crop,
    canvas: true,
  };

  const canvas = await loadImage(blob, loadImgOpts);

  if (!canvas || !canvas.originalWidth || !canvas.originalHeight) {
    throw new Error('failed to scale image');
  }

  let readAndResizedBlob = blob;

  if (
    canvas.originalWidth <= maxWidth &&
    canvas.originalHeight <= maxHeight &&
    blob.size <= maxSize &&
    !makeSquare
  ) {
    // the canvas has a size of whatever was given by the caller of autoscale().
    // so we have to return those measures as the loaded file has now those measures.
    return {
      ...attachment,
      width: canvas.image.width,
      height: canvas.image.height,
      blob,
    };
  }

  let quality = 0.95;
  let i = 4;
  do {
    i -= 1;
    readAndResizedBlob = dataURLToBlob(
      (canvas.image as HTMLCanvasElement).toDataURL('image/jpeg', quality)
    );

    quality = (quality * maxSize) / readAndResizedBlob.size;

    if (quality > 1) {
      quality = 0.95;
    }
  } while (i > 0 && readAndResizedBlob.size > maxSize);

  if (readAndResizedBlob.size > maxSize) {
    throw new Error('Cannot add this attachment even after trying to scale it down.');
  }
  return {
    contentType: attachment.contentType,
    blob: readAndResizedBlob,

    width: canvas.image.width,
    height: canvas.image.height,
  };
}

export async function getFileAndStoreLocally(
  attachment: StagedAttachmentType
): Promise<(StagedAttachmentType & { flags?: number }) | null> {
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
  });

  console.warn('attachmentSavedLocally', attachmentSavedLocally);

  return {
    caption: attachment.caption,
    contentType: attachment.contentType,
    fileName: attachment.fileName,
    file: new File([blob], 'getFile-blob'),
    fileSize: null,
    url: '',
    path: attachmentSavedLocally.path,
    width: scaled.width,
    height: scaled.height,
    screenshot: null,
    thumbnail: null,
    size: attachmentSavedLocally.size,

    // url: undefined,
    flags: attachmentFlags || undefined,
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
}: {
  attachment: AttachmentType;
  messageTimestamp: number;
  messageSender: string;
  conversationId: string;
}) => {
  const decryptedUrl = await getDecryptedMediaUrl(attachment.url, attachment.contentType, false);
  save({
    attachment: { ...attachment, url: decryptedUrl },
    document,
    getAbsolutePath: getAbsoluteAttachmentPath,
    timestamp: messageTimestamp,
  });
  await sendDataExtractionNotification(conversationId, messageSender, messageTimestamp);
};
