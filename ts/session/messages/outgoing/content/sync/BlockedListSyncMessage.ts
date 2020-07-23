import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { StringUtils } from '../../../../utils';

interface BlockedListSyncMessageParams extends MessageParams {
  groups: Array<string>;
  numbers: Array<string>;
}

export abstract class BlockedListSyncMessage extends SyncMessage {
  public readonly groups: Array<Uint8Array>;
  public readonly numbers: Array<string>;

  constructor(params: BlockedListSyncMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.groups = params.groups.map(g => {
      if (typeof g !== 'string') {
        throw new TypeError(
          `invalid group id (expected string) found:${typeof g}`
        );
      }
      return new Uint8Array(StringUtils.encode(g, 'utf8'));
    });
    if (params.numbers.length && typeof params.numbers[0] !== 'string') {
      throw new TypeError(
        `invalid number (expected string) found:${typeof params.numbers[0]}`
      );
    }
    this.numbers = params.numbers;
  }

  protected syncProto(): SignalService.SyncMessage {
    const syncMessage = super.syncProto();
    // currently we do not handle the closed group blocked
    syncMessage.blocked = new SignalService.SyncMessage.Blocked({
      numbers: this.numbers,
      groupIds: this.groups,
    });

    return syncMessage;
  }
}
