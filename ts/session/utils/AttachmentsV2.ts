import { Attachment } from '../../types/Attachment';

import { OpenGroupRequestCommonType } from '../apis/open_group_api/opengroupV2/ApiUtil';
import {
  AttachmentPointer,
  AttachmentPointerWithUrl,
  PreviewWithAttachmentUrl,
  Quote,
  QuotedAttachment,
} from '../messages/outgoing/visibleMessage/VisibleMessage';
import { uploadFileOpenGroupV2 } from '../apis/open_group_api/opengroupV2/OpenGroupAPIV2';
import { addAttachmentPadding } from '../crypto/BufferPadding';
import { RawPreview, RawQuote } from './Attachments';
import _ from 'lodash';
import { AttachmentsV2Utils } from '.';

interface UploadParamsV2 {
  attachment: Attachment;
  openGroup: OpenGroupRequestCommonType;
}

export async function uploadV2(params: UploadParamsV2): Promise<AttachmentPointerWithUrl> {
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

  const paddedAttachment: ArrayBuffer = !openGroup
    ? addAttachmentPadding(attachment.data)
    : attachment.data;

  const fileDetails = await uploadFileOpenGroupV2(new Uint8Array(paddedAttachment), openGroup);

  if (!fileDetails) {
    throw new Error(`upload to fileopengroupv2 of ${attachment.fileName} failed`);
  }

  return {
    ...pointer,
    id: fileDetails.fileId,
    url: fileDetails.fileUrl,
  };
}

export async function uploadAttachmentsV2(
  attachments: Array<Attachment>,
  openGroup: OpenGroupRequestCommonType
): Promise<Array<AttachmentPointerWithUrl>> {
  const promises = (attachments || []).map(async attachment =>
    AttachmentsV2Utils.uploadV2({
      attachment,
      openGroup,
    })
  );

  return Promise.all(promises);
}

export async function uploadLinkPreviewsV2(
  previews: Array<RawPreview>,
  openGroup: OpenGroupRequestCommonType
): Promise<Array<PreviewWithAttachmentUrl>> {
  const promises = (previews || []).map(async preview => {
    // some links does not have an image associated, and it makes the whole message fail to send
    if (!preview.image) {
      window.log.warn('tried to upload file to opengroupv2 without image.. skipping');

      return undefined;
    }
    const image = await AttachmentsV2Utils.uploadV2({
      attachment: preview.image,
      openGroup,
    });
    return {
      ...preview,
      image,
      url: preview.url || (image.url as string),
      id: image.id as number,
    };
  });
  return _.compact(await Promise.all(promises));
}

export async function uploadQuoteThumbnailsV2(
  openGroup: OpenGroupRequestCommonType,
  quote?: RawQuote
): Promise<Quote | undefined> {
  if (!quote) {
    return undefined;
  }

  const promises = (quote.attachments ?? []).map(async attachment => {
    let thumbnail: QuotedAttachment | undefined;
    if (attachment.thumbnail) {
      thumbnail = (await AttachmentsV2Utils.uploadV2({
        attachment: attachment.thumbnail,
        openGroup,
      })) as any;
    }
    return {
      ...attachment,
      thumbnail,
    };
  });

  const attachments = await Promise.all(promises);

  return {
    ...quote,
    attachments,
  };
}
