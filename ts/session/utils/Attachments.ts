import * as crypto from 'crypto';
import { Attachment } from '../../types/Attachment';
import { OpenGroup } from '../types';
import {
  AttachmentPointer,
  Preview,
  Quote,
  QuotedAttachment,
} from '../messages/outgoing';
import { LokiAppDotNetServerInterface } from '../../../js/modules/loki_app_dot_net_api';

interface UploadParams {
  attachment: Attachment;
  openGroup?: OpenGroup;
  isAvatar?: boolean;
  isRaw?: boolean;
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
  private constructor() {}

  public static getDefaultServer(): LokiAppDotNetServerInterface {
    return window.tokenlessFileServerAdnAPI;
  }

  public static async upload(params: UploadParams): Promise<AttachmentPointer> {
    const { attachment, openGroup, isAvatar = false, isRaw = false } = params;
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
      contentType: attachment.contentType
        ? (attachment.contentType as string)
        : undefined,
      size: attachment.size,
      fileName: attachment.fileName,
      flags: attachment.flags,
    };

    let attachmentData: ArrayBuffer;

    if (isRaw || openGroup) {
      attachmentData = attachment.data;
    } else {
      server = this.getDefaultServer();
      pointer.key = new Uint8Array(crypto.randomBytes(64));
      const iv = new Uint8Array(crypto.randomBytes(16));
      const data = await window.textsecure.crypto.encryptAttachment(
        attachment.data,
        pointer.key.buffer,
        iv.buffer
      );
      pointer.digest = data.digest;
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
      })
    );

    return Promise.all(promises);
  }

  public static async uploadLinkPreviews(
    previews: Array<RawPreview>,
    openGroup?: OpenGroup
  ): Promise<Array<Preview>> {
    const promises = (previews || []).map(async item => ({
      ...item,
      image: await this.upload({
        attachment: item.image,
        openGroup,
      }),
    }));
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
}
