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
import { addAttachmentPadding } from '../crypto/BufferPadding';

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
export class AttachmentFsV2Utils {
  private constructor() {}

  public static async uploadToFsV2(params: UploadParams): Promise<AttachmentPointer> {
    const { attachment, openGroup, isRaw = false, shouldPad = false } = params;
    if (typeof attachment !== 'object' || attachment == null) {
      throw new Error('Invalid attachment passed.');
    }

    if (!(attachment.data instanceof ArrayBuffer)) {
      throw new TypeError(
        `\`attachment.data\` must be an \`ArrayBuffer\`; got: ${typeof attachment.data}`
      );
    }
    // this can only be an opengroupv1
    if (openGroup) {
      throw new Error('opengroupv1 attachments are not supported anymore');
    }
    const pointer: AttachmentPointer = {
      contentType: attachment.contentType || undefined,
      size: attachment.size,
      fileName: attachment.fileName,
      flags: attachment.flags,
      caption: attachment.caption,
    };

    let attachmentData: ArrayBuffer;

    // We don't pad attachments for opengroup as they are unencrypted
    if (isRaw || openGroup) {
      attachmentData = attachment.data;
    } else {
      pointer.key = new Uint8Array(crypto.randomBytes(64));
      const iv = new Uint8Array(crypto.randomBytes(16));

      const dataToEncrypt =
        !shouldPad || !window.lokiFeatureFlags.padOutgoingAttachments
          ? attachment.data
          : addAttachmentPadding(attachment.data);
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
        window?.log?.warn('upload to file server v2 failed');
      }
      return pointer;
    } else {
      throw new Error('Only v2 fileserver upload is supported');
    }
  }

  public static async uploadAttachmentsToFsV2(
    attachments: Array<Attachment>,
    openGroup?: OpenGroup
  ): Promise<Array<AttachmentPointer>> {
    const promises = (attachments || []).map(async attachment =>
      this.uploadToFsV2({
        attachment,
        openGroup,
        shouldPad: true,
      })
    );

    return Promise.all(promises);
  }

  public static async uploadLinkPreviewsToFsV2(
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
        image: await this.uploadToFsV2({
          attachment: item.image,
          openGroup,
        }),
      };
    });
    return Promise.all(promises);
  }

  public static async uploadQuoteThumbnailsToFsV2(
    quote?: RawQuote,
    openGroup?: OpenGroup
  ): Promise<Quote | undefined> {
    if (!quote) {
      return undefined;
    }

    const promises = (quote.attachments ?? []).map(async attachment => {
      let thumbnail: AttachmentPointer | undefined;
      if (attachment.thumbnail) {
        thumbnail = await this.uploadToFsV2({
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
