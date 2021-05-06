import _ from 'lodash';

import { MessageModel } from '../models/message';
import { saveMessage } from '../../ts/data/data';
import { fromBase64ToArrayBuffer } from '../session/utils/String';
import { AttachmentDownloads, AttachmentUtils } from '../session/utils';
import { ConversationModel } from '../models/conversation';
import {
  downloadFileOpenGroupV2,
  downloadFileOpenGroupV2ByUrl,
} from '../opengroup/opengroupV2/OpenGroupAPIV2';
import { OpenGroupRequestCommonType } from '../opengroup/opengroupV2/ApiUtil';
import { FSv2 } from '../fileserver';

export async function downloadAttachment(attachment: any) {
  const serverUrl = new URL(attachment.url).origin;

  // The fileserver adds the `-static` part for some reason
  const defaultFileserver = _.includes(
    ['https://file-static.lokinet.org', 'https://file.getsession.org'],
    serverUrl
  );
  // is it an attachment hosted on the file server v2 ?
  const defaultFsV2 = _.startsWith(serverUrl, FSv2.fileServerV2URL);

  let res: ArrayBuffer | null = null;

  if (defaultFsV2) {
    if (!attachment.id) {
      window.log.warn('Cannot download fsv2 file with empty id');
      return;
    }
    window.log.info('Download v2 file server attachment');
    res = await FSv2.downloadFileFromFSv2(attachment.id);
  } else if (!defaultFileserver) {
    // TODO: we need attachments to remember which API should be used to retrieve them
    const serverAPI = await window.lokiPublicChatAPI.findOrCreateServer(serverUrl);

    if (serverAPI) {
      res = await serverAPI.downloadAttachment(attachment.url);
    }
  }

  // Fallback to using the default fileserver
  if (defaultFileserver || !res || res.byteLength === 0) {
    res = await window.lokiFileServerAPI.downloadAttachment(attachment.url);
  }

  if (res.byteLength === 0) {
    window.log.error('Failed to download attachment. Length is 0');
    throw new Error(`Failed to download attachment. Length is 0 for ${attachment.url}`);
  }

  // The attachment id is actually just the absolute url of the attachment
  let data = res;
  if (!attachment.isRaw) {
    const { key, digest, size } = attachment;

    if (!key || !digest) {
      throw new Error('Attachment is not raw but we do not have a key to decode it');
    }

    data = await window.textsecure.crypto.decryptAttachment(
      data,
      fromBase64ToArrayBuffer(key),
      fromBase64ToArrayBuffer(digest)
    );

    if (!size || size !== data.byteLength) {
      // we might have padding, check that all the remaining bytes are padding bytes
      // otherwise we have an error.
      if (AttachmentUtils.isLeftOfBufferPaddingOnly(data, size)) {
        // we can safely remove the padding
        data = data.slice(0, size);
      } else {
        throw new Error(
          `downloadAttachment: Size ${size} did not match downloaded attachment size ${data.byteLength}`
        );
      }
    }
  }

  return {
    ..._.omit(attachment, 'digest', 'key'),
    data,
  };
}

/**
 *
 * @param attachment Either the details of the attachment to download (on a per room basis), or the pathName to the file you want to get
 */
export async function downloadAttachmentOpenGroupV2(
  attachment:
    | {
        id: number;
        url: string;
        size: number;
      }
    | string,
  roomInfos: OpenGroupRequestCommonType
) {
  if (typeof attachment === 'string') {
    const dataUintFromUrl = await downloadFileOpenGroupV2ByUrl(attachment, roomInfos);

    if (!dataUintFromUrl?.length) {
      window.log.error('Failed to download attachment. Length is 0');
      throw new Error(`Failed to download attachment. Length is 0 for ${attachment}`);
    }
    return dataUintFromUrl;
  }
  const dataUint = await downloadFileOpenGroupV2(attachment.id, roomInfos);

  if (!dataUint?.length) {
    window.log.error('Failed to download attachment. Length is 0');
    throw new Error(`Failed to download attachment. Length is 0 for ${attachment.url}`);
  }

  let data = dataUint;
  if (attachment.size !== dataUint.length) {
    // we might have padding, check that all the remaining bytes are padding bytes
    // otherwise we have an error.
    if (AttachmentUtils.isLeftOfBufferPaddingOnly(dataUint.buffer, attachment.size)) {
      // we can safely remove the padding
      data = data.slice(0, attachment.size);
    } else {
      throw new Error(
        `downloadAttachment: Size ${attachment.size} did not match downloaded attachment size ${data.byteLength}`
      );
    }
  } else {
    // nothing to do, the attachment has already the correct size. There is just no padding included, which is bas
    window.log.warn('Received opengroupv2 unpadded attachment');
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
  const openGroupV2Details = (isOpenGroupV2 && convo.toOpenGroupV2()) || undefined;
  const attachments = await Promise.all(
    normalAttachments.map(async (attachment: any, index: any) => {
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

async function processPreviews(message: MessageModel, convo: ConversationModel): Promise<number> {
  let addedCount = 0;
  const isOpenGroupV2 = convo.isOpenGroupV2();

  const preview = await Promise.all(
    (message.get('preview') || []).map(async (item: any, index: any) => {
      if (!item.image) {
        return item;
      }
      addedCount += 1;

      const image = await AttachmentDownloads.addJob(item.image, {
        messageId: message.id,
        type: 'preview',
        index,
        isOpenGroupV2,
      });

      return { ...item, image };
    })
  );

  message.set({ preview });

  return addedCount;
}

async function processAvatars(message: MessageModel, convo: ConversationModel): Promise<number> {
  let addedCount = 0;
  const isOpenGroupV2 = convo.isOpenGroupV2();

  const contacts = message.get('contact') || [];

  const contact = await Promise.all(
    contacts.map(async (item: any, index: any) => {
      if (!item.avatar || !item.avatar.avatar) {
        return item;
      }

      addedCount += 1;

      const avatarJob = await AttachmentDownloads.addJob(item.avatar.avatar, {
        messaeId: message.id,
        type: 'contact',
        index,
        isOpenGroupV2,
      });

      return {
        ...item,
        avatar: {
          ...item.avatar,
          avatar: avatarJob,
        },
      };
    })
  );

  message.set({ contact });

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
      });

      return { ...item, thumbnail };
    })
  );

  message.set({ quote });

  return addedCount;
}

async function processGroupAvatar(
  message: MessageModel,
  convo: ConversationModel
): Promise<boolean> {
  let group = message.get('group');

  if (!group || !group.avatar) {
    return false;
  }
  const isOpenGroupV2 = convo.isOpenGroupV2();

  group = {
    ...group,
    avatar: await AttachmentDownloads.addJob(group.avatar, {
      messageId: message.id,
      type: 'group-avatar',
      index: 0,
      isOpenGroupV2,
    }),
  };

  message.set({ group });

  return true;
}

export async function queueAttachmentDownloads(
  message: MessageModel,
  conversation: ConversationModel
): Promise<void> {
  let count = 0;

  count += await processNormalAttachments(message, message.get('attachments') || [], conversation);

  count += await processPreviews(message, conversation);

  count += await processAvatars(message, conversation);

  count += await processQuoteAttachments(message, conversation);

  if (await processGroupAvatar(message, conversation)) {
    count += 1;
  }

  if (count > 0) {
    await saveMessage(message.attributes);
  }
}
