import * as crypto from 'crypto';
import { Attachment } from '../../types/Attachment';

import { OpenGroupRequestCommonType } from '../../opengroup/opengroupV2/ApiUtil';
import {
  AttachmentPointer,
  Preview,
  Quote,
  QuotedAttachment,
} from '../messages/outgoing/visibleMessage/VisibleMessage';
import { AttachmentUtils } from './Attachments';
import { uploadFileOpenGroupV2 } from '../../opengroup/opengroupV2/OpenGroupAPIV2';
import { addAttachmentPadding } from '../crypto/BufferPadding';

interface UploadParamsV2 {
  attachment: Attachment;
  openGroup: OpenGroupRequestCommonType;
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

export async function uploadV2(params: UploadParamsV2): Promise<AttachmentPointer> {
  const { attachment, openGroup } = params;
  if (typeof attachment !== 'object' || attachment == null) {
    throw new Error('Invalid attachment passed.');
  }

  if (!(attachment.data instanceof ArrayBuffer)) {
    throw new TypeError(
      `attachment.data must be an ArrayBuffer but got: ${typeof attachment.data}`
    );
  }

  const pointer: AttachmentPointer = {
    contentType: attachment.contentType || undefined,
    size: attachment.size,
    fileName: attachment.fileName,
    flags: attachment.flags,
    caption: attachment.caption,
  };

  const paddedAttachment: ArrayBuffer =
    window.lokiFeatureFlags.padOutgoingAttachments && !openGroup
      ? addAttachmentPadding(attachment.data)
      : attachment.data;

  const fileDetails = await uploadFileOpenGroupV2(new Uint8Array(paddedAttachment), openGroup);

  pointer.id = fileDetails?.fileId || undefined;
  pointer.url = fileDetails?.fileUrl || undefined;

  return pointer;
}

export async function uploadAttachmentsV2(
  attachments: Array<Attachment>,
  openGroup: OpenGroupRequestCommonType
): Promise<Array<AttachmentPointer>> {
  const promises = (attachments || []).map(async attachment =>
    exports.uploadV2({
      attachment,
      openGroup,
    })
  );

  return Promise.all(promises);
}

export async function uploadLinkPreviewsV2(
  previews: Array<RawPreview>,
  openGroup: OpenGroupRequestCommonType
): Promise<Array<Preview>> {
  const promises = (previews || []).map(async item => {
    // some links does not have an image associated, and it makes the whole message fail to send
    if (!item.image) {
      return item;
    }
    return {
      ...item,
      image: await exports.uploadV2({
        attachment: item.image,
        openGroup,
      }),
    };
  });
  return Promise.all(promises);
}

export async function uploadQuoteThumbnailsV2(
  openGroup: OpenGroupRequestCommonType,
  quote?: RawQuote
): Promise<Quote | undefined> {
  if (!quote) {
    return undefined;
  }

  const promises = (quote.attachments ?? []).map(async attachment => {
    let thumbnail: AttachmentPointer | undefined;
    if (attachment.thumbnail) {
      thumbnail = await exports.uploadV2({
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
