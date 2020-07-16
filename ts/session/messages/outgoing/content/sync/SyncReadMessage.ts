import _ from 'lodash';
import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';

interface SyncReadMessageParams extends MessageParams {
  readMessages: Array<{ sender: string; timestamp: number }>;
}

export class SyncReadMessage extends SyncMessage {
  public readonly readMessages: Array<{ sender: string; timestamp: number }>;

  constructor(params: SyncReadMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.readMessages = params.readMessages;
  }

  protected syncProto(): SignalService.SyncMessage {
    const syncMessage = super.syncProto();
    syncMessage.read = [];
    for (const read of this.readMessages) {
      const readMessage = new SignalService.SyncMessage.Read();
      read.timestamp = _.toNumber(readMessage.timestamp);
      read.sender = readMessage.sender;
      syncMessage.read.push(readMessage);
    }

    return syncMessage;
  }
}
