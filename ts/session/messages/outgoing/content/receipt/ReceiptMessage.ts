import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';

export abstract class ReceiptMessage extends ContentMessage {
  private readonly timestamps: Array<number>;

  constructor(timestamp: number, identifier: string, timestamps: Array<number>) {
    super(timestamp, identifier);
    this.timestamps = timestamps;
  }

  public ttl(): number {
    return this.getDefaultTTL();
  }

  public abstract getReceiptType(): SignalService.ReceiptMessage.Type;

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      receiptMessage: this.receiptProto(),
    });
  }

  protected receiptProto(): SignalService.ReceiptMessage {
    return new SignalService.ReceiptMessage({
      type: this.getReceiptType(),
      timestamp: this.timestamps,
    });
  }
}

