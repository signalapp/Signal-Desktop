import { OutgoingMessage } from './OutgoingMessage';
import { SignalService } from '../../../protobuf';

export class OutgoingContentMessage implements OutgoingMessage {
  public timestamp: number;
  public identifier: string;
  public ttl: number;
  constructor(timestamp: number, identifier: string, ttl: number) {
    this.timestamp = timestamp;
    this.identifier = identifier;
    this.ttl = ttl;
  }

  // To discuss:
  // should padding be the responsibility of the message or should it be the responsibility of the message sender to pad messages
  // If it is the responsibility of the sender then `contentProto()` needs to become `protected` and not `public`
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
