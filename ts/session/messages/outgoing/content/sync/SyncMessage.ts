import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';
import { DataMessage, AttachmentPointer } from '../data';


interface UnidentifiedDeliveryStatus {
  destination?: string;
  unidentified?: boolean;
}

interface Sent {
  UnidentifiedDeliveryStatus: UnidentifiedDeliveryStatus;
  desination?: string;
  timestamp?: number;
  message?: DataMessage;
  expirationStartTimestamp?: number;
  unidentifiedStatus: Array<UnidentifiedDeliveryStatus>;
}

interface Contact {
  blob?: AttachmentPointer;
  complete?: boolean;
  data: any;
}

export interface SyncMessageParams {

}

export abstract class SyncMessage extends ContentMessage {
  public static canSync(message: ContentMessage): boolean {
    return message instanceof SyncMessage;
  }

  public abstract from(message: ContentMessage): SyncMessage;

  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected contentProto(): SignalService.Content {
    const dataMessage = new SignalService.DataMessage({

    });

    return new SignalService.Content({
      dataMessage,
      syncMessage: this.syncProto(),
    });
  }

  protected abstract syncProto(): SignalService.SyncMessage;
}
