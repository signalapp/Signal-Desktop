import { Message } from '../Message';
import { SignalService } from '../../../../protobuf';

export abstract class ContentMessage implements Message {
  public readonly timestamp: number;
  public readonly identifier: string;
  public readonly ttl: number;
  constructor(timestamp: number, identifier: string, ttl: number) {
    this.timestamp = timestamp;
    this.identifier = identifier;
    this.ttl = ttl;
  }

  public plainTextBuffer(): Uint8Array {
    const encoded = SignalService.Content.encode(this.contentProto()).finish();

    return this.processPlainTextBuffer(encoded);
  }

  protected abstract contentProto(): SignalService.Content;

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
