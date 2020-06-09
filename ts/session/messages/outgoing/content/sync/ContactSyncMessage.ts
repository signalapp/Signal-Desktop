import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { ContentMessage, SyncMessage } from '..';
import { ConversationController, textsecure, libloki, Whisper } from '../../../../../window';
import { PubKey } from '../../../../types';
import * as Data from '../../../../../../js/modules/data';

interface ContactSyncMessageParams extends MessageParams {

}

export class ContactSyncMessage extends SyncMessage {
  private readonly sendTo: Array<PubKey>;
  private readonly blocked: Array<PubKey>; // <--- convert to Array<string>
  private readonly options: any;

  
  constructor(params: MessageParams) {
    super(params);
  }

  public from(message: ContentMessage) {
    const { timestamp, identifier } = message;

    return new ContactSyncMessage({timestamp, identifier});
  }

  protected syncProto() {
    const request = new SignalService.SyncMessage.Request();
    request.type = SignalService.SyncMessage.Request.Type.CONTACTS;

    const syncMessage = new SignalService.SyncMessage();
    syncMessage.request = request;
    
    // const contacts = new SignalService.SyncMessage.Contacts();
    // contacts.

    SignalService.SyncMessage.Configuration
    SignalService.SyncMessage.Contacts.create(

    );
    SignalService.SyncMessage.Groups
    SignalService.SyncMessage.OpenGroupDetails
    SignalService.SyncMessage.Read
    
    const conversations = await Data.getAllConversations({ ConversationCollection: Whisper.ConversationCollection });
    const contacts = conversations.filter((conversation: any) => {
      return (
        !conversation.isMe() &&
        conversation.isPrivate() &&
        !conversation.isSecondaryDevice() &&
        conversation.isFriend()
      );
    });

    const syncMessage = await libloki.api.createContactSyncProtoMessage(contacts);


    // const rawContacts = this.sendTo.map(async (device: PubKey) => {
    //   const conversation = ConversationController.get(device.key);

    //   const profile = conversation.getLokiProfile();
    //   const name = profile
    //     ? profile.displayName
    //     : conversation.getProfileName();
        
    //   const status = await conversation.safeGetVerified();
    //   const protoState = textsecure.storage.protocol.convertVerifiedStatusToProtoState(
    //     status
    //   );

    //   const verified = new SignalService.Verified({
    //     state: protoState,
    //     destination: device.key,
    //     identityKey: textsecure.StringView.hexToArrayBuffer(device.key),
    //   });

    //   return {
    //     name,
    //     verified,
    //     number: device.key,
    //     nickname: conversation.getNickname(),
    //     blocked: conversation.isBlocked(),
    //     expireTimer: conversation.get('expireTimer'),
    //   };
    // });


    // // Convert raw contacts to an array of buffers
    // const contactDetails = rawContacts
    //   .filter(x => x.number !== textsecure.storage.user.getNumber())
    //   .map(x => new textsecure.protobuf.ContactDetails(x))
    //   .map(x => x.encode());
    // // Serialise array of byteBuffers into 1 byteBuffer
    // const byteBuffer = serialiseByteBuffers(contactDetails);
    // const data = new Uint8Array(byteBuffer.toArrayBuffer());
    // const contacts = new textsecure.protobuf.SyncMessage.Contacts({
    //   data,
    // });
    // const syncMessage = new textsecure.protobuf.SyncMessage({
    //   contacts,
    // });
    // return syncMessage;



  protected dataProto() {
    if dataMess
  }
}

const contactSyncMessage = new ContactSyncMessage({timestamp: Date.now(), identifier: 'sdfgfdsgfdsgsfdgfdsg'});

