import { Message, MessageParams } from './Message';
import { OpenGroup } from '../../../opengroup/opengroupV1/OpenGroup';
import { AttachmentPointer, Preview, Quote } from './visibleMessage/VisibleMessage';

interface OpenGroupMessageParams extends MessageParams {
  group: OpenGroup;
  attachments?: Array<AttachmentPointer>;
  preview?: Array<Preview>;
  body?: string;
  quote?: Quote;
}

export class OpenGroupMessage extends Message {
  public readonly group: OpenGroup;
  public readonly body?: string;
  public readonly attachments: Array<AttachmentPointer>;
  public readonly quote?: Quote;
  public readonly preview?: Array<Preview>;

  constructor({
    timestamp,
    group,
    attachments,
    body,
    quote,
    identifier,
    preview,
  }: OpenGroupMessageParams) {
    super({ timestamp, identifier });
    this.group = group;
    this.body = body;
    this.attachments = attachments ?? [];
    this.quote = quote;
    this.preview = preview ?? [];
  }
}
