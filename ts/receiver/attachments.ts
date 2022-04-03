import _ from 'lodash';

import { MessageModel } from '../models/message';
import { saveMessage } from '../../ts/data/data';
import { AttachmentDownloads } from '../session/utils';
import { ConversationModel } from '../models/conversation';
import {
  downloadFileOpenGroupV2,
  downloadFileOpenGroupV2ByUrl,
} from '../session/apis/open_group_api/opengroupV2/OpenGroupAPIV2';
import { OpenGroupRequestCommonType } from '../session/apis/open_group_api/opengroupV2/ApiUtil';
import { FSv2 } from '../session/apis/file_server_api';
import { getUnpaddedAttachment } from '../session/crypto/BufferPadding';
import { decryptAttachment } from '../util/crypto/attachmentsEncrypter';
import { callUtilsWorker } from '../webworker/workers/util_worker_interface';

export async function downloadAttachment(attachment: {
  url: string;
  id?: string;
  isRaw?: boolean;
  key?: string;
  digest?: string;
  size?: number;
}) {
  const asURL = new URL(attachment.url);
  const serverUrl = asURL.origin;

  // is it an attachment hosted on the file server v2 ?
  const defaultFsV2 = _.startsWith(serverUrl, FSv2.fileServerV2URL);

  let res: ArrayBuffer | null = null;

  if (defaultFsV2) {
    let attachmentId = attachment.id;
    if (!attachmentId) {
      // try to get the fileId from the end of the URL
      attachmentId = attachment.url;
    }
    window?.log?.info('Download v2 file server attachment', attachmentId);
    res = await FSv2.downloadFileFromFSv2(attachmentId);
  } else {
    window.log.warn(
      `downloadAttachment attachment is neither opengroup attachment nor fsv2... Dropping it ${asURL.href}`
    );
    throw new Error('Attachment url is not opengroupv2 nor fileserver v2. Unsupported');
  }

  if (!res?.byteLength) {
    window?.log?.error('Failed to download attachment. Length is 0');
    throw new Error(`Failed to download attachment. Length is 0 for ${attachment.url}`);
  }

  // The attachment id is actually just the absolute url of the attachment
  let data = res;
  if (!attachment.isRaw) {
    const { key, digest, size } = attachment;

    if (!key || !digest) {
      throw new Error('Attachment is not raw but we do not have a key to decode it');
    }
    if (!size) {
      throw new Error('Attachment expected size is 0');
    }

    const keyBuffer = (await callUtilsWorker('fromBase64ToArrayBuffer', key)) as ArrayBuffer;
    const digestBuffer = (await callUtilsWorker('fromBase64ToArrayBuffer', digest)) as ArrayBuffer;

    data = await decryptAttachment(data, keyBuffer, digestBuffer);

    if (size !== data.byteLength) {
      // we might have padding, check that all the remaining bytes are padding bytes
      // otherwise we have an error.
      const unpaddedData = getUnpaddedAttachment(data, size);
      if (!unpaddedData) {
        throw new Error(
          `downloadAttachment: Size ${size} did not match downloaded attachment size ${data.byteLength}`
        );
      }
      data = unpaddedData;
    }
  }

  return {
    ..._.omit(attachment, 'digest', 'key'),
    data,
  };
}

/**
 * This method should only be used when you know
 */
export async function downloadDataFromOpenGroupV2(
  fileUrl: string,
  roomInfos: OpenGroupRequestCommonType
) {
  const dataUintFromUrl = await downloadFileOpenGroupV2ByUrl(fileUrl, roomInfos);

  if (!dataUintFromUrl?.length) {
    window?.log?.error('Failed to download attachment. Length is 0');
    throw new Error(`Failed to download attachment. Length is 0 for ${fileUrl}`);
  }
  return dataUintFromUrl;
}

/**
 *
 * @param attachment Either the details of the attachment to download (on a per room basis), or the pathName to the file you want to get
 */
export async function downloadAttachmentOpenGroupV2(
  attachment: {
    id: number;
    url: string;
    size: number;
  },
  roomInfos: OpenGroupRequestCommonType
) {
  const dataUint = await downloadFileOpenGroupV2(attachment.id, roomInfos);

  if (!dataUint?.length) {
    window?.log?.error('Failed to download attachment. Length is 0');
    throw new Error(`Failed to download attachment. Length is 0 for ${attachment.url}`);
  }

  let data = dataUint;
  if (attachment.size !== dataUint.length) {
    // we might have padding, check that all the remaining bytes are padding bytes
    // otherwise we have an error.
    const unpaddedData = getUnpaddedAttachment(dataUint.buffer, attachment.size);
    if (!unpaddedData) {
      throw new Error(
        `downloadAttachment: Size ${attachment.size} did not match downloaded attachment size ${data.byteLength}`
      );
    }
    data = new Uint8Array(unpaddedData);
  } else {
    // nothing to do, the attachment has already the correct size.
    // There is just no padding included, which is what we agreed on
    window?.log?.info('Received opengroupv2 unpadded attachment size:', attachment.size);
  }

  return {
    ..._.omit(attachment, 'digest', 'key'),
    data: data.buffer,
  };
}

async function processNormalAttachments(
  message: MessageModel,
  normalAttachments: Array<any>,
  convo: ConversationModel
): Promise<number> {
  const isOpenGroupV2 = convo.isOpenGroupV2();

  if (message.isTrustedForAttachmentDownload()) {
    const openGroupV2Details = (isOpenGroupV2 && convo.toOpenGroupV2()) || undefined;
    const attachments = await Promise.all(
      normalAttachments.map(async (attachment: any, index: number) => {
        return AttachmentDownloads.addJob(attachment, {
          messageId: message.id,
          type: 'attachment',
          index,
          isOpenGroupV2,
          openGroupV2Details,
        });
      })
    );

    message.set({ attachments });

    return attachments.length;
  }
  window.log.info('No downloading attachments yet as this user is not trusted for now.');
  return 0;
}

async function processPreviews(message: MessageModel, convo: ConversationModel): Promise<number> {
  let addedCount = 0;
  const isOpenGroupV2 = convo.isOpenGroupV2();
  const openGroupV2Details = (isOpenGroupV2 && convo.toOpenGroupV2()) || undefined;

  const preview = await Promise.all(
    (message.get('preview') || []).map(async (item: any, index: number) => {
      if (!item.image) {
        return item;
      }
      addedCount += 1;

      const image = message.isTrustedForAttachmentDownload()
        ? await AttachmentDownloads.addJob(item.image, {
            messageId: message.id,
            type: 'preview',
            index,
            isOpenGroupV2,
            openGroupV2Details,
          })
        : null;

      return { ...item, image };
    })
  );

  message.set({ preview });

  return addedCount;
}

async function processQuoteAttachments(
  message: MessageModel,
  convo: ConversationModel
): Promise<number> {
  let addedCount = 0;

  const quote = message.get('quote');

  if (!quote || !quote.attachments || !quote.attachments.length) {
    return 0;
  }
  const isOpenGroupV2 = convo.isOpenGroupV2();
  const openGroupV2Details = (isOpenGroupV2 && convo.toOpenGroupV2()) || undefined;

  quote.attachments = await Promise.all(
    quote.attachments.map(async (item: any, index: any) => {
      // If we already have a path, then we copied this image from the quoted
      //    message and we don't need to download the attachment.
      if (!item.thumbnail || item.thumbnail.path) {
        return item;
      }

      addedCount += 1;

      const thumbnail = await AttachmentDownloads.addJob(item.thumbnail, {
        messageId: message.id,
        type: 'quote',
        index,
        isOpenGroupV2,
        openGroupV2Details,
      });

      return { ...item, thumbnail };
    })
  );

  message.set({ quote });

  return addedCount;
}

export async function queueAttachmentDownloads(
  message: MessageModel,
  conversation: ConversationModel
): Promise<void> {
  let count = 0;

  count += await processNormalAttachments(message, message.get('attachments') || [], conversation);

  count += await processPreviews(message, conversation);

  count += await processQuoteAttachments(message, conversation);

  if (count > 0) {
    await saveMessage(message.attributes);
  }
}
