import { DataMessage } from './DataMessage';
import { SignalService } from '../../../../../protobuf';

// this message type is probably to sub divise again.
// should handle quote, body, attachmentsPointer, ... @see DataMessage in compiled.d.ts
export abstract class RegularMessage extends DataMessage {
  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected dataProto(): SignalService.DataMessage {
    throw new Error('Not implemented');
  }
}
