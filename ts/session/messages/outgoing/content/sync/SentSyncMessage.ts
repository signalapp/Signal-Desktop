import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { PubKey } from '../../../../types';

interface SentSyncMessageParams extends MessageParams {
  dataMessage: SignalService.IDataMessage;
  expirationStartTimestamp?: number;
  sentTo?: Array<PubKey>;
  unidentifiedDeliveries?: Array<PubKey>;
  destination?: PubKey | string;
}

export class SentSyncMessage extends SyncMessage {
  public readonly dataMessage: SignalService.IDataMessage;
  public readonly expirationStartTimestamp?: number;
  public readonly sentTo?: Array<PubKey>;
  public readonly unidentifiedDeliveries?: Array<PubKey>;
  public readonly destination?: PubKey;

  constructor(params: SentSyncMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });

    this.dataMessage = params.dataMessage;
    this.expirationStartTimestamp = params.expirationStartTimestamp;
    this.sentTo = params.sentTo;
    this.unidentifiedDeliveries = params.unidentifiedDeliveries;

    const { destination } = params;
    this.destination = destination ? PubKey.cast(destination) : undefined;
  }

  protected syncProto(): SignalService.SyncMessage {
    const syncMessage = super.syncProto();
    syncMessage.sent = new SignalService.SyncMessage.Sent();
    syncMessage.sent.timestamp = this.timestamp;
    syncMessage.sent.message = this.dataMessage;
    if (this.destination) {
      syncMessage.sent.destination = this.destination.key;
    }
    if (this.expirationStartTimestamp) {
      syncMessage.sent.expirationStartTimestamp = this.expirationStartTimestamp;
    }

    if (this.unidentifiedDeliveries) {
      const unidentifiedLookup = this.unidentifiedDeliveries.reduce(
        (accumulator, item) => {
          // eslint-disable-next-line no-param-reassign
          accumulator[item.key] = true;
          return accumulator;
        },
        Object.create(null)
      );

      // Though this field has 'unidenified' in the name, it should have entries for each
      //   number we sent to.
      if (this.sentTo && this.sentTo.length) {
        syncMessage.sent.unidentifiedStatus = this.sentTo.map(number => {
          const status = new SignalService.SyncMessage.Sent.UnidentifiedDeliveryStatus();
          status.destination = number.key;
          status.unidentified = Boolean(unidentifiedLookup[number.key]);
          return status;
        });
      }
    }

    return syncMessage;
  }
}
