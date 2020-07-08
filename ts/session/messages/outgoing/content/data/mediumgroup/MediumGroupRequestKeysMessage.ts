import { SignalService } from '../../../../../../protobuf';
import { MediumGroupMessage } from '.';

export class MediumGroupRequestKeysMessage extends MediumGroupMessage {
  protected mediumGroupContext(): SignalService.MediumGroupUpdate {
    const mediumGroupContext = super.mediumGroupContext();

    mediumGroupContext.type =
      SignalService.MediumGroupUpdate.Type.SENDER_KEY_REQUEST;

    return mediumGroupContext;
  }
}
