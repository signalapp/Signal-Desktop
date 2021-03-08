import { DataMessage } from './DataMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { LokiProfile } from '../../../../../types/Message';
import ByteBuffer from 'bytebuffer';
import { Constants } from '../../../..';
import { isNumber, toNumber } from 'lodash';

export interface AttachmentPointer {
  id?: number;
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
  url?: string;
}

export interface Preview {
  url?: string;
  title?: string;
  image?: AttachmentPointer;
}

export interface QuotedAttachment {
  contentType?: string;
  fileName?: string;
  thumbnail?: AttachmentPointer;
}

export interface Quote {
  id?: number;
  author?: string;
  text?: string;
  attachments?: Array<QuotedAttachment>;
}

export interface ChatMessageParams extends MessageParams {
  attachments?: Array<AttachmentPointer>;
  body?: string;
  quote?: Quote;
  expireTimer?: number;
  lokiProfile?: LokiProfile;
  preview?: Array<Preview>;
  syncTarget?: string; // null means it is not a synced message
}

export class ChatMessage extends DataMessage {
  public readonly expireTimer?: number;

  private readonly attachments?: Array<AttachmentPointer>;
  private readonly body?: string;
  private readonly quote?: Quote;
  private readonly profileKey?: Uint8Array;
  private readonly displayName?: string;
  private readonly avatarPointer?: string;
  private readonly preview?: Array<Preview>;

  /// In the case of a sync message, the public key of the person the message was targeted at.
  /// - Note: `null or undefined` if this isn't a sync message.
  private readonly syncTarget?: string;

  constructor(params: ChatMessageParams) {
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

  public static buildSyncMessage(
    identifier: string,
    dataMessage: SignalService.DataMessage,
    syncTarget: string,
    sentTimestamp: number
  ) {
    if (
      (dataMessage as any).constructor.name !== 'DataMessage' &&
      !(dataMessage instanceof SignalService.DataMessage)
    ) {
      window.log.warn(
        'buildSyncMessage with something else than a DataMessage'
      );
    }

    if (!sentTimestamp || !isNumber(sentTimestamp)) {
      throw new Error('Tried to build a sync message without a sentTimestamp');
    }
    // don't include our profileKey on syncing message. This is to be done by a ConfigurationMessage now
    const timestamp = toNumber(sentTimestamp);
    const body = dataMessage.body || undefined;

    const wrapToUInt8Array = (buffer: any) => {
      if (!buffer) {
        return undefined;
      }
      if (buffer instanceof Uint8Array) {
        // Audio messages are already uint8Array
        return buffer;
      }
      return new Uint8Array(buffer.toArrayBuffer());
    };
    const attachments = (dataMessage.attachments || []).map(attachment => {
      const key = wrapToUInt8Array(attachment.key);
      const digest = wrapToUInt8Array(attachment.digest);

      return {
        ...attachment,
        key,
        digest,
      };
    }) as Array<AttachmentPointer>;
    const quote = (dataMessage.quote as Quote) || undefined;
    const preview = (dataMessage.preview as Array<Preview>) || [];

    return new ChatMessage({
      identifier,
      timestamp,
      attachments,
      body,
      quote,
      preview,
      syncTarget,
    });
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.REGULAR_MESSAGE;
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
        dataMessage.quote.attachments = this.quote.attachments.map(
          (attachment: QuotedAttachment) => {
            const quotedAttachment = new SignalService.DataMessage.Quote.QuotedAttachment();
            if (attachment.contentType) {
              quotedAttachment.contentType = attachment.contentType;
            }
            if (attachment.fileName) {
              quotedAttachment.fileName = attachment.fileName;
            }
            if (attachment.thumbnail) {
              quotedAttachment.thumbnail = attachment.thumbnail;
            }

            return quotedAttachment;
          }
        );
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

  public isEqual(comparator: ChatMessage): boolean {
    return (
      this.identifier === comparator.identifier &&
      this.timestamp === comparator.timestamp
    );
  }
}
