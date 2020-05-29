import { Message, MessageParams } from './Message';
import { AttachmentType } from '../../../types/Attachment';
import { QuotedAttachmentType } from '../../../components/conversation/Quote';

interface OpenGroupMessageParams extends MessageParams {
  server: string;
  attachments?: Array<AttachmentType>;
  body?: string;
  quote?: QuotedAttachmentType;
}

export class OpenGroupMessage extends Message {
  public readonly server: string;
  public readonly body?: string;
  public readonly attachments?: Array<AttachmentType>;
  public readonly quote?: QuotedAttachmentType;

  constructor({
      timestamp,
      server,
      attachments,
      body,
      quote,
      identifier,
    } : OpenGroupMessageParams) {
    super({ timestamp, identifier });
    this.server = server;
    this.body = body;
    this.attachments = attachments;
    this.quote = quote;
  }
}
