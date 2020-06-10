import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { ContentMessage, SyncMessage } from '../';
import { ConversationController, textsecure, libloki, Whisper } from '../../../../../window';
import { PubKey } from '../../../../types';
import * as Data from '../../../../../../js/modules/data';
import { ChatMessage, DataMessage } from '../data';


interface ContactSyncMessageParams extends MessageParams {
  // Send to our devices
  linkedDevices: Array<PubKey>;
  dataMessage?: DataMessage;
}

export class ContactSyncMessage extends SyncMessage {
  constructor(params: ContactSyncMessageParams) {
    super(params);
  }
  
  protected syncProto() {
    
    // const contacts = new SignalService.SyncMessage.Contacts();
    // contacts.

    // SignalService.SyncMessage.Configuration
    // SignalService.SyncMessage.Contacts.create(

    // );
    // SignalService.SyncMessage.Groups
    // SignalService.SyncMessage.OpenGroupDetails
    // SignalService.SyncMessage.Read
    
    const conversations = await Data.getAllConversations({ ConversationCollection: Whisper.ConversationCollection });
    const contacts = conversations.filter((conversation: any) => {
      return (
        !conversation.isMe() &&
        conversation.isPrivate() &&
        !conversation.isSecondaryDevice() &&
        conversation.isFriend()
      );
    });

    const syncMessage = await libloki.api.createContactSyncProtoMessage(contacts) as SignalService.SyncMessage;
    
    // TODO: Is this a request sync message or a basic sync message?
    // Set request type
    const request = new SignalService.SyncMessage.Request();
    request.type = SignalService.SyncMessage.Request.Type.CONTACTS;
    syncMessage.request = request;

    return syncMessage;
  }

  // protected dataProto() {
  //   if dataMess
  // }
}
