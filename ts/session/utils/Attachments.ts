import * as crypto from 'crypto';
import { Attachment } from '../../types/Attachment';

import {
  AttachmentPointer,
  Preview,
  Quote,
  QuotedAttachment,
} from '../messages/outgoing/visibleMessage/VisibleMessage';
import { OpenGroup } from '../../opengroup/opengroupV1/OpenGroup';
import { FSv2 } from '../../fileserver';

interface UploadParams {
  attachment: Attachment;
  openGroup?: OpenGroup;
  isAvatar?: boolean;
  isRaw?: boolean;
  shouldPad?: boolean;
}

interface RawPreview {
  url?: string;
  title?: string;
  image: Attachment;
}

interface RawQuoteAttachment {
  contentType?: string;
  fileName?: string;
  thumbnail?: Attachment;
}

interface RawQuote {
  id?: number;
  author?: string;
  text?: string;
  attachments?: Array<RawQuoteAttachment>;
}

// tslint:disable-next-line: no-unnecessary-class
export class AttachmentUtils {
  public static readonly PADDING_BYTE = 0;

  private constructor() {}

  public static async uploadV1(params: UploadParams): Promise<AttachmentPointer> {
    const { attachment, openGroup, isAvatar = false, isRaw = false, shouldPad = false } = params;
    if (typeof attachment !== 'object' || attachment == null) {
      throw new Error('Invalid attachment passed.');
    }

    if (!(attachment.data instanceof ArrayBuffer)) {
      throw new TypeError(
        `\`attachment.data\` must be an \`ArrayBuffer\`; got: ${typeof attachment.data}`
      );
    }

    let server = window.tokenlessFileServerAdnAPI;
    // this can only be an opengroupv1
    if (openGroup) {
      const openGroupServer = await window.lokiPublicChatAPI.findOrCreateServer(openGroup.server);
      if (!openGroupServer) {
        throw new Error(`Failed to get open group server: ${openGroup.server}.`);
      }
      server = openGroupServer;
    }
    const pointer: AttachmentPointer = {
      contentType: attachment.contentType || undefined,
      size: attachment.size,
      fileName: attachment.fileName,
      flags: attachment.flags,
      caption: attachment.caption,
    };

    let attachmentData: ArrayBuffer;

    if (isRaw || openGroup) {
      attachmentData = attachment.data;
    } else {
      server = window.tokenlessFileServerAdnAPI;
      pointer.key = new Uint8Array(crypto.randomBytes(64));
      const iv = new Uint8Array(crypto.randomBytes(16));

      const dataToEncrypt =
        !shouldPad || !window.lokiFeatureFlags.padOutgoingAttachments
          ? attachment.data
          : AttachmentUtils.addAttachmentPadding(attachment.data);
      const data = await window.textsecure.crypto.encryptAttachment(
        dataToEncrypt,
        pointer.key.buffer,
        iv.buffer
      );
      pointer.digest = new Uint8Array(data.digest);
      attachmentData = data.ciphertext;
    }

    // use file server v2

    if (FSv2.useFileServerAPIV2Sending) {
      const uploadToV2Result = await FSv2.uploadFileToFsV2(attachmentData);
      if (uploadToV2Result) {
        pointer.id = uploadToV2Result.fileId;
        pointer.url = uploadToV2Result.fileUrl;
      } else {
        console.warn('upload to file server v2 failed');
      }
    } else {
      const result = isAvatar
        ? await server.putAvatar(attachmentData)
        : await server.putAttachment(attachmentData);
      pointer.id = result.id;
      pointer.url = result.url;
    }

    return pointer;
  }

  public static async uploadAvatarV1(
    attachment?: Attachment
  ): Promise<AttachmentPointer | undefined> {
    if (!attachment) {
      return undefined;
    }

    // isRaw is true since the data is already encrypted
    // and doesn't need to be encrypted again
    return this.uploadV1({
      attachment,
      isAvatar: true,
      isRaw: true,
    });
  }

  public static async uploadAttachmentsV1(
    attachments: Array<Attachment>,
    openGroup?: OpenGroup
  ): Promise<Array<AttachmentPointer>> {
    const promises = (attachments || []).map(async attachment =>
      this.uploadV1({
        attachment,
        openGroup,
        shouldPad: true,
      })
    );

    return Promise.all(promises);
  }

  public static async uploadLinkPreviewsV1(
    previews: Array<RawPreview>,
    openGroup?: OpenGroup
  ): Promise<Array<Preview>> {
    const promises = (previews || []).map(async item => {
      // some links does not have an image associated, and it makes the whole message fail to send
      if (!item.image) {
        return item;
      }
      return {
        ...item,
        image: await this.uploadV1({
          attachment: item.image,
          openGroup,
        }),
      };
    });
    return Promise.all(promises);
  }

  public static async uploadQuoteThumbnailsV1(
    quote?: RawQuote,
    openGroup?: OpenGroup
  ): Promise<Quote | undefined> {
    if (!quote) {
      return undefined;
    }

    const promises = (quote.attachments ?? []).map(async attachment => {
      let thumbnail: AttachmentPointer | undefined;
      if (attachment.thumbnail) {
        thumbnail = await this.uploadV1({
          attachment: attachment.thumbnail,
          openGroup,
        });
      }
      return {
        ...attachment,
        thumbnail,
      } as QuotedAttachment;
    });

    const attachments = await Promise.all(promises);

    return {
      ...quote,
      attachments,
    };
  }

  public static isLeftOfBufferPaddingOnly(
    data: ArrayBuffer,
    unpaddedExpectedSize: number
  ): boolean {
    // to have a padding we must have a strictly longer length expected
    if (data.byteLength <= unpaddedExpectedSize) {
      return false;
    }
    const dataUint = new Uint8Array(data);
    for (let i = unpaddedExpectedSize; i < data.byteLength; i++) {
      if (dataUint[i] !== this.PADDING_BYTE) {
        return false;
      }
    }

    return true;
  }

  public static addAttachmentPadding(data: ArrayBuffer): ArrayBuffer {
    const originalUInt = new Uint8Array(data);

    const paddedSize = Math.max(
      541,
      Math.floor(Math.pow(1.05, Math.ceil(Math.log(originalUInt.length) / Math.log(1.05))))
    );
    const paddedData = new ArrayBuffer(paddedSize);
    const paddedUInt = new Uint8Array(paddedData);

    paddedUInt.fill(AttachmentUtils.PADDING_BYTE, originalUInt.length);
    paddedUInt.set(originalUInt);

    return paddedUInt.buffer;
  }
}
