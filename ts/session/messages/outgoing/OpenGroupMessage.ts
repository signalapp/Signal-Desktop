import { Message } from './Message';
import { AttachmentType } from '../../../types/Attachment';
import { QuotedAttachmentType } from '../../../components/conversation/Quote';

interface OpenGroupMessageParams {
  timestamp: number;
  identifier: string;
  server: string;
  attachments: [AttachmentType];
  body?: string;
  quote?: QuotedAttachmentType;
}

export class OpenGroupMessage extends Message {
  public readonly server: string;
  public readonly body?: string;
  public readonly attachments: [AttachmentType]; // TODO: Not sure if we should only use a subset of this type
  public readonly quote?: QuotedAttachmentType;

  constructor({
      identifier,
      timestamp,
      server,
      attachments,
      body,
      quote,
    } : OpenGroupMessageParams) {
    super({ timestamp, identifier });
    this.server = server;
    this.body = body;
    this.attachments = attachments;
    this.quote = quote;
  }
}
