import { SignalService } from '../../../../protobuf';
import { DisappearingMessageType } from '../../../../util/expiringMessages';
import { PubKey } from '../../../types';
import { StringUtils } from '../../../utils';
import { MessageParams } from '../Message';
import { VisibleMessage } from '../visibleMessage/VisibleMessage';

interface ExpirationTimerUpdateMessageParams extends MessageParams {
  groupId?: string | PubKey;
  syncTarget?: string | PubKey;
  expirationType: DisappearingMessageType | null;
  expireTimer: number | null;
  lastDisappearingMessageChangeTimestamp: number | null;
}

// Note the old disappearing messages used a data message for the expiration time.
// The new ones use properties on the Content Message
// We will remove support for the old one 2 weeks after the release
export class ExpirationTimerUpdateMessage extends VisibleMessage {
  public readonly groupId?: PubKey;
  public readonly lastDisappearingMessageChangeTimestamp: number | null;

  constructor(params: ExpirationTimerUpdateMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      expirationType: params.expirationType,
      expireTimer: params.expireTimer || undefined,
      syncTarget: params.syncTarget ? PubKey.cast(params.syncTarget).key : undefined,
    });

    this.lastDisappearingMessageChangeTimestamp = params.lastDisappearingMessageChangeTimestamp;

    const { groupId } = params;
    this.groupId = groupId ? PubKey.cast(groupId) : undefined;
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      dataMessage: this.dataProto(),
      expirationType:
        this.expirationType === 'deleteAfterSend'
          ? SignalService.Content.ExpirationType.DELETE_AFTER_SEND
          : SignalService.Content.ExpirationType.DELETE_AFTER_READ,
      expirationTimer: this.expireTimer,
      lastDisappearingMessageChangeTimestamp: this.lastDisappearingMessageChangeTimestamp,
    });
  }

  public dataProto(): SignalService.DataMessage {
    const data = super.dataProto();

    data.flags = SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;

    // FIXME we shouldn't need this once android recieving refactor is done.
    // the envelope stores the groupId for a closed group already.
    if (this.groupId) {
      const groupMessage = new SignalService.GroupContext();
      const groupIdWithPrefix = PubKey.addTextSecurePrefixIfNeeded(this.groupId.key);
      const encoded = StringUtils.encode(groupIdWithPrefix, 'utf8');
      const id = new Uint8Array(encoded);
      groupMessage.id = id;
      groupMessage.type = SignalService.GroupContext.Type.DELIVER;

      data.group = groupMessage;
    }

    // TODO remove 2 weeks after the release
    if (this.expireTimer) {
      data.expireTimer = this.expireTimer;
    }

    return data;
  }
}
