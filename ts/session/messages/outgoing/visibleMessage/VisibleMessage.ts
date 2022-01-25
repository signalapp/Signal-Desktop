import ByteBuffer from 'bytebuffer';
import { DataMessage } from '..';
import { SignalService } from '../../../../protobuf';
import { LokiProfile } from '../../../../types/Message';
import { MessageParams } from '../Message';

interface AttachmentPointerCommon {
  contentType?: string;
  key?: Uint8Array;
  size?: number;
  thumbnail?: Uint8Array;
  digest?: Uint8Array;
  fileName?: string;
  flags?: number;
  width?: number;
  height?: number;
  caption?: string;
}

export interface AttachmentPointer extends AttachmentPointerCommon {
  url?: string;
  id?: number;
}

export interface AttachmentPointerWithUrl extends AttachmentPointerCommon {
  url: string;
  id: number;
}

export interface Preview {
  url: string;
  title?: string;
  image?: AttachmentPointer;
}

export interface PreviewWithAttachmentUrl {
  url: string;
  title?: string;
  image?: AttachmentPointerWithUrl;
}

interface QuotedAttachmentCommon {
  contentType?: string;
  fileName?: string;
}

export interface QuotedAttachment extends QuotedAttachmentCommon {
  thumbnail?: AttachmentPointer;
}

export interface QuotedAttachmentWithUrl extends QuotedAttachmentCommon {
  thumbnail?: AttachmentPointerWithUrl | QuotedAttachment;
}

export interface Quote {
  id: number;
  author: string;
  text?: string;
  attachments?: Array<QuotedAttachmentWithUrl>;
}

export interface VisibleMessageParams extends MessageParams {
  attachments?: Array<AttachmentPointerWithUrl>;
  body?: string;
  quote?: Quote;
  expireTimer?: number;
  lokiProfile?: LokiProfile;
  preview?: Array<PreviewWithAttachmentUrl>;
  syncTarget?: string; // undefined means it is not a synced message
}

export class VisibleMessage extends DataMessage {
  public readonly expireTimer?: number;

  private readonly attachments?: Array<AttachmentPointerWithUrl>;
  private readonly body?: string;
  private readonly quote?: Quote;
  private readonly profileKey?: Uint8Array;
  private readonly displayName?: string;
  private readonly avatarPointer?: string;
  private readonly preview?: Array<PreviewWithAttachmentUrl>;

  /// In the case of a sync message, the public key of the person the message was targeted at.
  /// - Note: `null or undefined` if this isn't a sync message.
  private readonly syncTarget?: string;

  constructor(params: VisibleMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.attachments = params.attachments;
    this.body = params.body;
    this.quote = params.quote;
    this.expireTimer = params.expireTimer;
    if (params.lokiProfile && params.lokiProfile.profileKey) {
      if (
        params.lokiProfile.profileKey instanceof Uint8Array ||
        (params.lokiProfile.profileKey as any) instanceof ByteBuffer
      ) {
        this.profileKey = new Uint8Array(params.lokiProfile.profileKey);
      } else {
        this.profileKey = new Uint8Array(
          ByteBuffer.wrap(params.lokiProfile.profileKey).toArrayBuffer()
        );
      }
    }

    this.displayName = params.lokiProfile && params.lokiProfile.displayName;
    this.avatarPointer = params.lokiProfile && params.lokiProfile.avatarPointer;
    this.preview = params.preview;
    this.syncTarget = params.syncTarget;
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();

    if (this.body) {
      dataMessage.body = this.body;
    }

    dataMessage.attachments = this.attachments || [];

    if (this.expireTimer) {
      dataMessage.expireTimer = this.expireTimer;
    }

    if (this.preview) {
      dataMessage.preview = this.preview;
    }
    if (this.syncTarget) {
      dataMessage.syncTarget = this.syncTarget;
    }

    if (this.avatarPointer || this.displayName) {
      const profile = new SignalService.DataMessage.LokiProfile();

      if (this.avatarPointer) {
        profile.profilePicture = this.avatarPointer;
      }

      if (this.displayName) {
        profile.displayName = this.displayName;
      }
      dataMessage.profile = profile;
    }
    if (this.profileKey && this.profileKey.length) {
      dataMessage.profileKey = this.profileKey;
    }

    if (this.quote) {
      dataMessage.quote = new SignalService.DataMessage.Quote();

      dataMessage.quote.id = this.quote.id;
      dataMessage.quote.author = this.quote.author;
      dataMessage.quote.text = this.quote.text;
      if (this.quote.attachments) {
        dataMessage.quote.attachments = this.quote.attachments.map(attachment => {
          const quotedAttachment = new SignalService.DataMessage.Quote.QuotedAttachment();
          if (attachment.contentType) {
            quotedAttachment.contentType = attachment.contentType;
          }
          if (attachment.fileName) {
            quotedAttachment.fileName = attachment.fileName;
          }
          if (attachment.thumbnail && (attachment.thumbnail as any).id) {
            quotedAttachment.thumbnail = attachment.thumbnail as any; // be sure to keep the typescript guard on id above
          }

          return quotedAttachment;
        });
      }
    }

    if (Array.isArray(this.preview)) {
      dataMessage.preview = this.preview.map(preview => {
        const item = new SignalService.DataMessage.Preview();
        if (preview.title) {
          item.title = preview.title;
        }
        if (preview.url) {
          item.url = preview.url;
        }
        item.image = preview.image || null;

        return item;
      });
    }

    dataMessage.timestamp = this.timestamp;

    return dataMessage;
  }

  public isEqual(comparator: VisibleMessage): boolean {
    return this.identifier === comparator.identifier && this.timestamp === comparator.timestamp;
  }
}
