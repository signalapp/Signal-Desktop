import { MessageModel } from '../../js/models/message';

// TODO: Might convert it to a class later
let webAPI: any;

export async function downloadAttachment(attachment: any) {
  const _ = window.Lodash;

  if (!webAPI) {
    webAPI = window.WebAPI.connect();
  }

  // The attachment id is actually just the absolute url of the attachment
  let data = await webAPI.getAttachment(attachment.url);
  if (!attachment.isRaw) {
    const { key, digest, size } = attachment;

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

async function processLongAttachments(
  message: MessageModel,
  attachments: Array<any>
): Promise<boolean> {
  if (attachments.length === 0) {
    return false;
  }

  if (attachments.length > 1) {
    window.log.error(
      `Received more than one long message attachment in message ${message.idForLogging()}`
    );
  }

  const attachment = attachments[0];

  message.set({ bodyPending: true });
  await window.Signal.AttachmentDownloads.addJob(attachment, {
    messageId: message.id,
    type: 'long-message',
    index: 0,
  });

  return true;
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
  const _ = window.Lodash;
  const { Whisper } = window;

  let count = 0;

  const [longMessageAttachments, normalAttachments] = _.partition(
    message.get('attachments') || [],
    (attachment: any) =>
      attachment.contentType === Whisper.Message.LONG_MESSAGE_CONTENT_TYPE
  );

  if (await processLongAttachments(message, longMessageAttachments)) {
    count += 1;
  }

  count += await processNormalAttachments(message, normalAttachments);

  count += await processPreviews(message);

  count += await processAvatars(message);

  count += await processQuoteAttachments(message);

  if (await processGroupAvatar(message)) {
    count += 1;
  }

  if (count > 0) {
    await window.Signal.Data.saveMessage(message.attributes, {
      Message: Whisper.Message,
    });

    return true;
  }

  return false;
}
