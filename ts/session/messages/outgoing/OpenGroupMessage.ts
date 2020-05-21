import { OutgoingMessage } from './OutgoingMessage';
import { AttachmentType } from '../../../types/Attachment';
import { QuotedAttachmentType } from '../../../components/conversation/Quote';

export class OpenGroupMessage implements OutgoingMessage {
  public timestamp: number;
  public server: string;
  public body?: string;
  public attachments: [AttachmentType]; // TODO: Not sure if we should only use a subset of this type
  public quote?: QuotedAttachmentType;

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
