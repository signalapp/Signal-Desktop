import { SignalService } from '../../../protobuf';
import { DisappearingMessageType } from '../../../util/expiringMessages';
import { DURATION, TTL_DEFAULT } from '../../constants';
import { ContentMessage } from './ContentMessage';
import { MessageParams } from './Message';

export interface ExpirableMessageParams extends MessageParams {
  expirationType?: DisappearingMessageType;
  expireTimer?: number;
}

export class ExpirableMessage extends ContentMessage {
  public readonly expirationType?: DisappearingMessageType;
  public readonly expireTimer?: number;

  constructor(params: ExpirableMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.expirationType = params.expirationType;
    this.expireTimer = params.expireTimer;
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      expirationType:
        this.expirationType === 'deleteAfterSend'
          ? SignalService.Content.ExpirationType.DELETE_AFTER_SEND
          : SignalService.Content.ExpirationType.DELETE_AFTER_READ,
      expirationTimer: this.expireTimer,
    });
  }

  public getDisappearingMessageType(): DisappearingMessageType | undefined {
    return this.expirationType;
  }

  // TODO need to account for legacy messages here?
  public ttl(): number {
    switch (this.expirationType) {
      case 'deleteAfterSend':
        return this.expireTimer ? this.expireTimer * DURATION.SECONDS : TTL_DEFAULT.TTL_MAX;
      case 'deleteAfterRead':
        return TTL_DEFAULT.TTL_MAX;
      default:
        return TTL_DEFAULT.TTL_MAX;
    }
  }
}
