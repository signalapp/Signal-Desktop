import { SignalService } from '../../../../../protobuf';
import { ReceiptMessage } from './ReceiptMessage';

export class DeliveryReceiptMessage extends ReceiptMessage {
  public getReceiptType(): SignalService.ReceiptMessage.Type {
    return SignalService.ReceiptMessage.Type.DELIVERY;
  }
}
