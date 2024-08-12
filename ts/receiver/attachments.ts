import { omit, startsWith } from 'lodash';

import { MessageModel } from '../models/message';
import { Data } from '../data/data';
import { AttachmentDownloads } from '../session/utils';
import { ConversationModel } from '../models/conversation';
import { getUnpaddedAttachment } from '../session/crypto/BufferPadding';
import { decryptAttachment } from '../util/crypto/attachmentsEncrypter';
import { callUtilsWorker } from '../webworker/workers/browser/util_worker_interface';
import { sogsV3FetchFileByFileID } from '../session/apis/open_group_api/sogsv3/sogsV3FetchFile';
import { OpenGroupData } from '../data/opengroups';
import {
  downloadFileFromFileServer,
  fileServerURL,
} from '../session/apis/file_server_api/FileServerApi';
import { OpenGroupRequestCommonType } from '../data/types';

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

  // is it an attachment hosted on the file server
  const defaultFileServer = startsWith(serverUrl, fileServerURL);

  let res: ArrayBuffer | null = null;

  if (defaultFileServer) {
    let attachmentId = attachment.id;
    if (!attachmentId) {
      // try to get the fileId from the end of the URL
      attachmentId = attachment.url;
    }
    window?.log?.info('Download v2 file server attachment', attachmentId);
    res = await downloadFileFromFileServer(attachmentId);
  } else {
    window.log.warn(
      `downloadAttachment attachment is neither opengroup attachment nor fileserver... Dropping it ${asURL.href}`
    );
    throw new Error('Attachment url is not opengroupv2 nor fileserver. Unsupported');
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
    ...omit(attachment, 'digest', 'key'),
    data,
  };
}

/**
 *
 * Download the attachment based on the url.
 * The only time where the size should be set to null, is when downloading the image for a sogs room (as we do not have the size for it).
 *
 * @param attachment Either the details of the attachment to download (on a per room basis), or the pathName to the file you want to get
 */
export async function downloadAttachmentSogsV3(
  attachment: {
    id: number;
    url: string;
    size: number | null;
  },
  roomInfos: OpenGroupRequestCommonType
) {
  const roomDetails = OpenGroupData.getV2OpenGroupRoomByRoomId(roomInfos);
  if (!roomDetails) {
    throw new Error(`Didn't find such a room ${roomInfos.serverUrl}: ${roomInfos.roomId}`);
  }

  const dataUint = await sogsV3FetchFileByFileID(roomDetails, `${attachment.id}`);

  if (!dataUint?.length) {
    window?.log?.error('Failed to download attachment. Length is 0');
    throw new Error(`Failed to download attachment. Length is 0 for ${attachment.url}`);
  }

  if (attachment.size === null) {
    return {
      ...omit(attachment, 'digest', 'key'),
      data: dataUint.buffer,
    };
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
    // window?.log?.info('Received opengroupv2 unpadded attachment size:', attachment.size);
  }

  return {
    ...omit(attachment, 'digest', 'key'),
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

  for (let index = 0; index < quote.attachments.length; index++) {
    // If we already have a path, then we copied this image from the quoted
    // message and we don't need to download the attachment.
    const attachment = quote.attachments[index];

    if (!attachment.thumbnail || attachment.thumbnail.path) {
      continue;
    }

    addedCount += 1;

    // eslint-disable-next-line no-await-in-loop
    const thumbnail = await AttachmentDownloads.addJob(attachment.thumbnail, {
      messageId: message.id,
      type: 'quote',
      index,
      isOpenGroupV2,
      openGroupV2Details,
    });

    quote.attachments[index] = { ...attachment, thumbnail };
  }

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
    await Data.saveMessage(message.attributes);
  }
}
