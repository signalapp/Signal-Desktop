import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { ContentMessage, SyncMessage } from '../';
import { ConversationController, textsecure, libloki, Whisper } from '../../../../../window';
import { PubKey } from '../../../../types';
import * as Data from '../../../../../../js/modules/data';
import { ChatMessage, DataMessage } from '../data';


interface GroupSyncMessageParams extends MessageParams {
  // Send to our devices
  linkedDevices: Array<PubKey>;
  dataMessage?: DataMessage;
}

export class GroupSyncMessage extends SyncMessage {
  constructor(params: GroupSyncMessageParams) {
    super(params);
  }
  
  protected syncProto(): SignalService.SyncMessage {
    
    return new SignalService.SyncMessage();
}
