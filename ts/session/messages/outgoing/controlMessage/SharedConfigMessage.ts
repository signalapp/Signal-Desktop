// this is not a very good name, but a configuration message is a message sent to our other devices so sync our current public and closed groups
import Long from 'long';

import { ContentMessage } from '..';
import { SignalService } from '../../../../protobuf';
import { TTL_DEFAULT } from '../../../constants';
import { MessageParams } from '../Message';

interface SharedConfigParams extends MessageParams {
  seqno: Long;
  kind: SignalService.SharedConfigMessage.Kind;
  readyToSendData: Uint8Array;
}

export class SharedConfigMessage extends ContentMessage {
  public readonly seqno: Long;
  public readonly kind: SignalService.SharedConfigMessage.Kind;
  public readonly readyToSendData: Uint8Array;

  constructor(params: SharedConfigParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.readyToSendData = params.readyToSendData;
    this.kind = params.kind;
    this.seqno = params.seqno;
  }

  public contentProto(): SignalService.Content {
    throw new Error('SharedConfigMessage must not be sent wrapped anymore');
  }

  public ttl(): number {
    return TTL_DEFAULT.CONFIG_MESSAGE;
  }
}
