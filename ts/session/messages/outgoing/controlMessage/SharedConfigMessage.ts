// this is not a very good name, but a configuration message is a message sent to our other devices so sync our current public and closed groups
import Long from 'long';

import { ContentMessage } from '..';
import { SignalService } from '../../../../protobuf';
import { TTL_DEFAULT } from '../../../constants';
import { MessageParams } from '../Message';

interface SharedConfigParams extends MessageParams {
  seqno: Long;
  kind: SignalService.SharedConfigMessage.Kind;
  data: Uint8Array;
}

export class SharedConfigMessage extends ContentMessage {
  public readonly seqno: Long;
  public readonly kind: SignalService.SharedConfigMessage.Kind;
  public readonly data: Uint8Array;

  constructor(params: SharedConfigParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.data = params.data;
    this.kind = params.kind;
    this.seqno = params.seqno;
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      sharedConfigMessage: this.sharedConfigProto(),
    });
  }

  public ttl(): number {
    return TTL_DEFAULT.CONFIG_MESSAGE;
  }

  protected sharedConfigProto(): SignalService.SharedConfigMessage {
    return new SignalService.SharedConfigMessage({
      data: this.data,
      kind: this.kind,
      seqno: this.seqno,
    });
  }
}
