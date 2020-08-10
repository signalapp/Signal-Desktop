import { SignalService } from '../../../../../../protobuf';
import { MediumGroupMessage } from '.';

export class MediumGroupQuitMessage extends MediumGroupMessage {
  protected mediumGroupContext(): SignalService.MediumGroupUpdate {
    const mediumGroupContext = super.mediumGroupContext();

    mediumGroupContext.type = SignalService.MediumGroupUpdate.Type.QUIT;

    return mediumGroupContext;
  }
}
