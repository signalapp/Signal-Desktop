import { SignalService } from '../../../protobuf';
import { DisappearingMessageType } from '../../../util/expiringMessages';
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
}
