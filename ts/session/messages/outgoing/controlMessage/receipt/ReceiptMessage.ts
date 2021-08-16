import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { ContentMessage } from '../..';

interface ReceiptMessageParams extends MessageParams {
  timestamps: Array<number>;
}
export abstract class ReceiptMessage extends ContentMessage {
  public readonly timestamps: Array<number>;

  constructor({ timestamp, identifier, timestamps }: ReceiptMessageParams) {
    super({ timestamp, identifier });
    this.timestamps = timestamps;
  }

  public abstract getReceiptType(): SignalService.ReceiptMessage.Type;

  public contentProto(): SignalService.Content {
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
