import { OutgoingMessage } from './OutgoingMessage';
import { SignalService } from '../../../protobuf';

export class OutgoingContentMessage implements OutgoingMessage {
  public timestamp: number;
  public identifier: string;
  public category: OutgoingContentMessage.MessageCategory;
  public ttl: number;
  constructor(
    timestamp: number,
    identifier: string,
    category: OutgoingContentMessage.MessageCategory,
    ttl: number
  ) {
    this.timestamp = timestamp;
    this.identifier = identifier;
    this.category = category;
    this.ttl = ttl;
  }

  public plainTextBuffer(): Uint8Array {
    const encoded = SignalService.Content.encode(this.contentProto()).finish();

    return this.processPlainTextBuffer(encoded);
  }

  public contentProto(): SignalService.Content {
    throw new Error('contentProto() needs to be implemented.');
  }

  private processPlainTextBuffer(buffer: Uint8Array): Uint8Array {
    const paddedMessageLength = this.getPaddedMessageLength(
      buffer.byteLength + 1
    );
    const plainText = new Uint8Array(paddedMessageLength - 1);
    plainText.set(new Uint8Array(buffer));
    plainText[buffer.byteLength] = 0x80;

    return plainText;
  }

  private getPaddedMessageLength(length: number): number {
    const messageLengthWithTerminator = length + 1;
    let messagePartCount = Math.floor(messageLengthWithTerminator / 160);

    if (messageLengthWithTerminator % 160 !== 0) {
      messagePartCount += 1;
    }

    return messagePartCount * 160;
  }
}

export namespace OutgoingContentMessage {
  export enum MessageCategory {
    Secure,
    SessionReset,
    MediumGroup,
  }
}
