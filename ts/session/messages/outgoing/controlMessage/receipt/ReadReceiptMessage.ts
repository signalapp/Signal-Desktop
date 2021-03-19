import { SignalService } from '../../../../../protobuf';
import { ReceiptMessage } from './ReceiptMessage';

export class ReadReceiptMessage extends ReceiptMessage {
  public getReceiptType(): SignalService.ReceiptMessage.Type {
    return SignalService.ReceiptMessage.Type.READ;
  }
}
