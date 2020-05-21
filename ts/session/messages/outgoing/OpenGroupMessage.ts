import { Message } from './Message';
import { AttachmentType } from '../../../types/Attachment';
import { QuotedAttachmentType } from '../../../components/conversation/Quote';

export class OpenGroupMessage implements Message {
  public readonly timestamp: number;
  public readonly server: string;
  public readonly body?: string;
  public readonly attachments: [AttachmentType]; // TODO: Not sure if we should only use a subset of this type
  public readonly quote?: QuotedAttachmentType;

  constructor(
    timestamp: number,
    server: string,
    attachments: [AttachmentType],
    body?: string,
    quote?: QuotedAttachmentType
  ) {
    this.timestamp = timestamp;
    this.server = server;
    this.body = body;
    this.attachments = attachments;
    this.quote = quote;
  }
}
