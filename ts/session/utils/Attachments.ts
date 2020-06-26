import * as crypto from 'crypto';
import { Attachment } from '../../types/Attachment';
import { OpenGroup } from '../types';
import { AttachmentPointer } from '../messages/outgoing';
import { LokiAppDotNetServerInterface } from '../../../js/modules/loki_app_dot_net_api';

interface UploadParams {
  attachment: Attachment;
  openGroup?: OpenGroup;
  isAvatar?: boolean;
  isRaw?: boolean;
}

// tslint:disable-next-line: no-unnecessary-class
export class Attachments {
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
}
