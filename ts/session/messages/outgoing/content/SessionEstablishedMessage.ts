import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';
import * as crypto from 'crypto';
import { MessageParams } from '../Message';

export class SessionEstablishedMessage extends ContentMessage {
  public readonly padding: Buffer;

  constructor(params: MessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    // Generate a random int from 1 and 512
    const buffer = crypto.randomBytes(1);

    // tslint:disable-next-line: no-bitwise
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    this.padding = crypto.randomBytes(paddingLength);
  }
  public ttl(): number {
    return 5 * 60 * 1000;
  }

  protected contentProto(): SignalService.Content {
    const nullMessage = new SignalService.NullMessage({});

    nullMessage.padding = this.padding;
    return new SignalService.Content({
      nullMessage,
    });
  }
}
