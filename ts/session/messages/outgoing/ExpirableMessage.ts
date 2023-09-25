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
  /** in seconds, 0 means no expiration */
  public readonly expireTimer?: number;

  constructor(params: ExpirableMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
    });
    this.expirationType = params.expirationType;
    this.expireTimer = params.expireTimer;
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      // TODO legacy messages support will be removed in a future release
      expirationType:
        this.expirationType === 'deleteAfterSend'
          ? SignalService.Content.ExpirationType.DELETE_AFTER_SEND
          : this.expirationType === 'deleteAfterRead'
          ? SignalService.Content.ExpirationType.DELETE_AFTER_READ
          : this.expirationType === 'unknown'
          ? SignalService.Content.ExpirationType.UNKNOWN
          : undefined,
      expirationTimer: this.expireTimer && this.expireTimer > -1 ? this.expireTimer : undefined,
    });
  }

  public dataProto(): SignalService.DataMessage {
    return new SignalService.DataMessage({
      // TODO legacy messages support will be removed in a future release
      expireTimer:
        (this.expirationType === 'unknown' || !this.expirationType) &&
        this.expireTimer &&
        this.expireTimer > -1
          ? this.expireTimer
          : undefined,
    });
  }

  public getDisappearingMessageType(): DisappearingMessageType | undefined {
    return this.expirationType;
  }

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
