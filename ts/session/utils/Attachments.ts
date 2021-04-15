import * as crypto from 'crypto';
import { Attachment } from '../../types/Attachment';

import { LokiAppDotNetServerInterface } from '../../../js/modules/loki_app_dot_net_api';
import {
  AttachmentPointer,
  Preview,
  Quote,
  QuotedAttachment,
} from '../messages/outgoing/visibleMessage/VisibleMessage';
import { OpenGroup } from '../../opengroup/opengroupV1/OpenGroup';

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

  public static getDefaultServer(): LokiAppDotNetServerInterface {
    return window.tokenlessFileServerAdnAPI;
  }

  public static async upload(params: UploadParams): Promise<AttachmentPointer> {
    const {
      attachment,
      openGroup,
      isAvatar = false,
      isRaw = false,
      shouldPad = false,
    } = params;
    if (typeof attachment !== 'object' || attachment == null) {
      throw new Error('Invalid attachment passed.');
    }

    if (!(attachment.data instanceof ArrayBuffer)) {
      throw new TypeError(
        `\`attachment.data\` must be an \`ArrayBuffer\`; got: ${typeof attachment.data}`
      );
    }

    let server = this.getDefaultServer();
    if (openGroup) {
      const openGroupServer = await window.lokiPublicChatAPI.findOrCreateServer(
        openGroup.server
      );
      if (!openGroupServer) {
        throw new Error(
          `Failed to get open group server: ${openGroup.server}.`
        );
      }
      server = openGroupServer;
    }
    const pointer: AttachmentPointer = {
      contentType: attachment.contentType ? attachment.contentType : undefined,
      size: attachment.size,
      fileName: attachment.fileName,
      flags: attachment.flags,
      caption: attachment.caption,
    };

    let attachmentData: ArrayBuffer;

    if (isRaw || openGroup) {
      attachmentData = attachment.data;
    } else {
      server = this.getDefaultServer();
      pointer.key = new Uint8Array(crypto.randomBytes(64));
      const iv = new Uint8Array(crypto.randomBytes(16));

      const dataToEncrypt = !shouldPad
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

    const result = isAvatar
      ? await server.putAvatar(attachmentData)
      : await server.putAttachment(attachmentData);

    pointer.id = result.id;
    pointer.url = result.url;

    return pointer;
  }

  public static async uploadAvatar(
    attachment?: Attachment
  ): Promise<AttachmentPointer | undefined> {
    if (!attachment) {
      return undefined;
    }

    // isRaw is true since the data is already encrypted
    // and doesn't need to be encrypted again
    return this.upload({
      attachment,
      isAvatar: true,
      isRaw: true,
    });
  }

  public static async uploadAttachments(
    attachments: Array<Attachment>,
    openGroup?: OpenGroup
  ): Promise<Array<AttachmentPointer>> {
    const promises = (attachments || []).map(async attachment =>
      this.upload({
        attachment,
        openGroup,
        shouldPad: true,
      })
    );

    return Promise.all(promises);
  }

  public static async uploadLinkPreviews(
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
        image: await this.upload({
          attachment: item.image,
          openGroup,
        }),
      };
    });
    return Promise.all(promises);
  }

  public static async uploadQuoteThumbnails(
    quote?: RawQuote,
    openGroup?: OpenGroup
  ): Promise<Quote | undefined> {
    if (!quote) {
      return undefined;
    }

    const promises = (quote.attachments ?? []).map(async attachment => {
      let thumbnail: AttachmentPointer | undefined;
      if (attachment.thumbnail) {
        thumbnail = await this.upload({
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

  private static addAttachmentPadding(data: ArrayBuffer): ArrayBuffer {
    const originalUInt = new Uint8Array(data);

    const paddedSize = Math.max(
      541,
      Math.floor(
        Math.pow(
          1.05,
          Math.ceil(Math.log(originalUInt.length) / Math.log(1.05))
        )
      )
    );
    const paddedData = new ArrayBuffer(paddedSize);
    const paddedUInt = new Uint8Array(paddedData);

    paddedUInt.fill(AttachmentUtils.PADDING_BYTE, originalUInt.length);
    paddedUInt.set(originalUInt);

    return paddedUInt.buffer;
  }
}
