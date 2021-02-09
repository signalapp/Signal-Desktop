import _ from 'lodash';

import { MessageModel } from '../models/message';
import { saveMessage } from '../../js/modules/data';

export async function downloadAttachment(attachment: any) {
  const serverUrl = new URL(attachment.url).origin;

  // The fileserver adds the `-static` part for some reason
  const defaultFileserver = _.includes(
    ['https://file-static.lokinet.org', 'https://file.getsession.org'],
    serverUrl
  );

  let res: ArrayBuffer | null = null;

  // TODO: we need attachments to remember which API should be used to retrieve them
  if (!defaultFileserver) {
    const serverAPI = await window.lokiPublicChatAPI.findOrCreateServer(
      serverUrl
    );

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
    throw new Error(
      `Failed to download attachment. Length is 0 for ${attachment.url}`
    );
  }

  // FIXME "178" test to remove once this is fixed server side.
  if (!window.lokiFeatureFlags.useFileOnionRequestsV2) {
    if (res.byteLength === 178) {
      window.log.error(
        'Data of 178 length corresponds of a 404 returned as 200 by file.getsession.org.'
      );
      throw new Error(
        `downloadAttachment: invalid response for ${attachment.url}`
      );
    }
  } else {
    // if useFileOnionRequestsV2 is true, we expect an ArrayBuffer not empty
  }

  // The attachment id is actually just the absolute url of the attachment
  let data = res;
  if (!attachment.isRaw) {
    const { key, digest, size } = attachment;

    if (!key || !digest) {
      throw new Error(
        'Attachment is not raw but we do not have a key to decode it'
      );
    }

    data = await window.textsecure.crypto.decryptAttachment(
      data,
      window.Signal.Crypto.base64ToArrayBuffer(key),
      window.Signal.Crypto.base64ToArrayBuffer(digest)
    );

    if (!size || size !== data.byteLength) {
      throw new Error(
        `downloadAttachment: Size ${size} did not match downloaded attachment size ${data.byteLength}`
      );
    }
  }

  return {
    ..._.omit(attachment, 'digest', 'key'),
    data,
  };
}

async function processNormalAttachments(
  message: MessageModel,
  normalAttachments: Array<any>
): Promise<number> {
  const attachments = await Promise.all(
    normalAttachments.map((attachment: any, index: any) => {
      return window.Signal.AttachmentDownloads.addJob(attachment, {
        messageId: message.id,
        type: 'attachment',
        index,
      });
    })
  );

  message.set({ attachments });

  return attachments.length;
}

async function processPreviews(message: MessageModel): Promise<number> {
  let addedCount = 0;

  const preview = await Promise.all(
    (message.get('preview') || []).map(async (item: any, index: any) => {
      if (!item.image) {
        return item;
      }
      addedCount += 1;

      const image = await window.Signal.AttachmentDownloads.addJob(item.image, {
        messageId: message.id,
        type: 'preview',
        index,
      });

      return { ...item, image };
    })
  );

  message.set({ preview });

  return addedCount;
}

async function processAvatars(message: MessageModel): Promise<number> {
  let addedCount = 0;

  const contacts = message.get('contact') || [];

  const contact = await Promise.all(
    contacts.map(async (item: any, index: any) => {
      if (!item.avatar || !item.avatar.avatar) {
        return item;
      }

      addedCount += 1;

      const avatarJob = await window.Signal.AttachmentDownloads.addJob(
        item.avatar.avatar,
        {
          messaeId: message.id,
          type: 'contact',
          index,
        }
      );

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

async function processQuoteAttachments(message: MessageModel): Promise<number> {
  let addedCount = 0;

  const quote = message.get('quote');

  if (!quote || !quote.attachments || !quote.attachments.length) {
    return 0;
  }

  quote.attachments = await Promise.all(
    quote.attachments.map(async (item: any, index: any) => {
      // If we already have a path, then we copied this image from the quoted
      //    message and we don't need to download the attachment.
      if (!item.thumbnail || item.thumbnail.path) {
        return item;
      }

      addedCount += 1;

      const thumbnail = await window.Signal.AttachmentDownloads.addJob(
        item.thumbnail,
        {
          messageId: message.id,
          type: 'quote',
          index,
        }
      );

      return { ...item, thumbnail };
    })
  );

  message.set({ quote });

  return addedCount;
}

async function processGroupAvatar(message: MessageModel): Promise<boolean> {
  let group = message.get('group');

  if (!group || !group.avatar) {
    return false;
  }

  group = {
    ...group,
    avatar: await window.Signal.AttachmentDownloads.addJob(group.avatar, {
      messageId: message.id,
      type: 'group-avatar',
      index: 0,
    }),
  };

  message.set({ group });

  return true;
}

export async function queueAttachmentDownloads(
  message: MessageModel
): Promise<boolean> {
  const { Whisper } = window;

  let count = 0;

  count += await processNormalAttachments(message, message.get('attachments'));

  count += await processPreviews(message);

  count += await processAvatars(message);

  count += await processQuoteAttachments(message);

  if (await processGroupAvatar(message)) {
    count += 1;
  }

  if (count > 0) {
    await saveMessage(message.attributes, {
      Message: Whisper.Message,
    });

    return true;
  }

  return false;
}
