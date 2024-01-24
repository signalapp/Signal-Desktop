import { ipcRenderer } from 'electron';
import { isArrayBuffer, isEmpty, isString, isUndefined, omit } from 'lodash';
import { ConversationAttributes } from '../models/conversationAttributes';
import { createDeleter, getAttachmentsPath } from '../shared/attachments/shared_attachments';
import {
  createAbsolutePathGetter,
  createReader,
  createWriterForNew,
} from '../util/attachments_files';
import {
  autoOrientJPEGAttachment,
  captureDimensionsAndScreenshot,
  deleteData,
  loadData,
  replaceUnicodeV2,
} from './attachments/migrations';

// NOTE I think this is only used on the renderer side, but how?!
export const deleteExternalMessageFiles = async (message: {
  attachments: any;
  quote: any;
  preview: any;
}) => {
  const { attachments, quote, preview } = message;

  if (attachments && attachments.length) {
    await Promise.all(attachments.map(deleteData));
  }

  if (quote && quote.attachments && quote.attachments.length) {
    await Promise.all(
      quote.attachments.map(async (_attachment: { thumbnail: any }) => {
        const attachment = _attachment;
        const { thumbnail } = attachment;

        // To prevent spoofing, we copy the original image from the quoted message.
        //   If so, it will have a 'copied' field. We don't want to delete it if it has
        //   that field set to true.
        if (thumbnail && thumbnail.path && !thumbnail.copied) {
          await deleteOnDisk(thumbnail.path);
        }

        attachment.thumbnail = undefined;
        return attachment;
      })
    );
  }

  if (preview && preview.length) {
    await Promise.all(
      preview.map(async (_item: { image: any }) => {
        const item = _item;
        const { image } = item;

        if (image && image.path) {
          await deleteOnDisk(image.path);
        }

        item.image = undefined;
        return image;
      })
    );
  }
};

let attachmentsPath: string | undefined;

let internalReadAttachmentData: ((relativePath: string) => Promise<ArrayBufferLike>) | undefined;
let internalGetAbsoluteAttachmentPath: ((relativePath: string) => string) | undefined;
let internalDeleteOnDisk: ((relativePath: string) => Promise<void>) | undefined;
let internalWriteNewAttachmentData: ((arrayBuffer: ArrayBuffer) => Promise<string>) | undefined;

// userDataPath must be app.getPath('userData');
export async function initializeAttachmentLogic() {
  const userDataPath = await ipcRenderer.invoke('get-user-data-path');

  if (attachmentsPath) {
    throw new Error('attachmentsPath already initialized');
  }

  if (!userDataPath || userDataPath.length <= 10) {
    throw new Error('userDataPath cannot have length <= 10');
  }
  attachmentsPath = getAttachmentsPath(userDataPath);
  internalReadAttachmentData = createReader(attachmentsPath);
  internalGetAbsoluteAttachmentPath = createAbsolutePathGetter(attachmentsPath);
  internalDeleteOnDisk = createDeleter(attachmentsPath);
  internalWriteNewAttachmentData = createWriterForNew(attachmentsPath);
}

export const getAttachmentPath = () => {
  if (!attachmentsPath) {
    throw new Error('attachmentsPath not init');
  }
  return attachmentsPath;
};

export const loadAttachmentData = loadData;

export const loadPreviewData = async (preview: any): Promise<Array<any>> => {
  if (!preview || !preview.length || isEmpty(preview[0])) {
    return [];
  }

  const firstPreview = preview[0];
  if (!firstPreview.image) {
    return [firstPreview];
  }

  return [
    {
      ...firstPreview,
      image: await loadAttachmentData(firstPreview.image),
    },
  ];
};

export const loadQuoteData = async (quote: any) => {
  if (!quote) {
    return null;
  }
  if (!quote.attachments?.length || isEmpty(quote.attachments[0])) {
    return quote;
  }

  const quotedFirstAttachment = await quote.attachments[0];

  const { thumbnail } = quotedFirstAttachment;

  if (!thumbnail || !thumbnail.path) {
    return {
      ...quote,
      attachments: [quotedFirstAttachment],
    };
  }
  const quotedAttachmentWithThumbnail = {
    ...quotedFirstAttachment,
    thumbnail: await loadAttachmentData(thumbnail),
  };

  return {
    ...quote,
    attachments: [quotedAttachmentWithThumbnail],
  };
};

export const processNewAttachment = async (attachment: {
  fileName?: string;
  contentType: string;
  data: ArrayBuffer;
  digest?: string;
  path?: string;
  isRaw?: boolean;
}) => {
  const fileName = attachment.fileName ? replaceUnicodeV2(attachment.fileName) : '';
  // this operation might change the size (as we might print the content to a canvas and get the data back)
  const rotatedData = await autoOrientJPEGAttachment(attachment);

  const onDiskAttachmentPath = await migrateDataToFileSystem(rotatedData.data);
  const attachmentWithoutData = omit({ ...attachment, fileName, path: onDiskAttachmentPath }, [
    'data',
  ]);
  if (rotatedData.shouldDeleteDigest) {
    delete attachmentWithoutData.digest;
  }
  const finalAttachment = await captureDimensionsAndScreenshot(attachmentWithoutData);

  return { ...finalAttachment, fileName, size: rotatedData.data.byteLength };
};

export const readAttachmentData = async (relativePath: string): Promise<ArrayBufferLike> => {
  if (!internalReadAttachmentData) {
    throw new Error('attachment logic not initialized');
  }
  return internalReadAttachmentData(relativePath);
};

export const getAbsoluteAttachmentPath = (relativePath?: string): string => {
  if (!internalGetAbsoluteAttachmentPath) {
    throw new Error('attachment logic not initialized');
  }
  return internalGetAbsoluteAttachmentPath(relativePath || '');
};

export const deleteOnDisk = async (relativePath: string): Promise<void> => {
  if (!internalDeleteOnDisk) {
    throw new Error('attachment logic not initialized');
  }
  return internalDeleteOnDisk(relativePath);
};

export const writeNewAttachmentData = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  if (!internalWriteNewAttachmentData) {
    throw new Error('attachment logic not initialized');
  }
  return internalWriteNewAttachmentData(arrayBuffer);
};

// type Context :: {
//   writeNewAttachmentData :: ArrayBuffer -> Promise (IO Path)
// }
//
//      migrateDataToFileSystem :: Attachment ->
//                                 Context ->
//                                 Promise Attachment
export const migrateDataToFileSystem = async (data?: ArrayBuffer) => {
  const hasDataField = !isUndefined(data);

  if (!hasDataField) {
    throw new Error('attachment has no data in migrateDataToFileSystem');
  }

  const isValidData = isArrayBuffer(data);
  if (!isValidData) {
    throw new TypeError(`Expected ${data} to be an array buffer got: ${typeof data}`);
  }

  const path = await writeNewAttachmentData(data);

  return path;
};

export async function deleteExternalFilesOfConversation(
  conversationAttributes: ConversationAttributes
) {
  if (!conversationAttributes) {
    return;
  }

  const { avatarInProfile } = conversationAttributes;

  if (isString(avatarInProfile) && avatarInProfile.length) {
    await deleteOnDisk(avatarInProfile);
  }
}
