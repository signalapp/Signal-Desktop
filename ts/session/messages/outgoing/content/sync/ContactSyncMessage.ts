import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { ContentMessage, SyncMessage } from '../';
import { ConversationController, textsecure, libloki, Whisper } from '../../../../../window';
import { PubKey } from '../../../../types';
import * as Data from '../../../../../../js/modules/data';
import { ChatMessage, DataMessage } from '../data';


interface ContactSyncMessageParams extends MessageParams {
  // Send to our devices
  contacts: Array<PubKey>;
  dataMessage?: DataMessage;
}

export class ContactSyncMessage extends SyncMessage {
  private readonly contacts: Array<PubKey>;
  private readonly dataMessage?: DataMessage;

  constructor(params: ContactSyncMessageParams) {
    super(params);

    this.contacts = params.contacts;
    this.dataMessage = params.dataMessage;

    this.syncProto();
  }

  protected syncProto(): SignalService.SyncMessage {
    
    // const contacts = new SignalService.SyncMessage.Contacts();
    // contacts.

    // SignalService.SyncMessage.Configuration
    // SignalService.SyncMessage.Contacts.create(

    // );
    // SignalService.SyncMessage.Groups
    // SignalService.SyncMessage.OpenGroupDetails
    // SignalService.SyncMessage.Read
    
    const syncMessage = new SignalService.SyncMessage({

    });


    syncMessage.contacts = this.contacts.map(pubkey => ConversationController.get(pubkey.key));
    
    // TODO: Is this a request sync message or a basic sync message?
    // Set request type
    const request = new SignalService.SyncMessage.Request();
    request.type = SignalService.SyncMessage.Request.Type.CONTACTS;
    syncMessage.request = request;

    contentMessage.syncMessage = syncMessage;
      

    const silent = true;

    const debugMessageType =
      window.textsecure.OutgoingMessage.DebugMessageType.CONTACT_SYNC_SEND;


    return syncMessage;
  }

  // protected dataProto() {
  //   if dataMess
  // }
}


// LOOOK HERE!!! FOR OW TO BUILD

  //   // We need to sync across 3 contacts at a time
  //   // This is to avoid hitting storage server limit
  //   const chunked = _.chunk([...contactsSet], 3);
  //   const syncMessages = await Promise.all(
  //     chunked.map(c => libloki.api.createContactSyncProtoMessage(c))
  //   );
  //   const syncPromises = syncMessages
  //     .filter(message => message != null)
  //     .map(syncMessage => {
  //       const contentMessage = new textsecure.protobuf.Content();
  //       contentMessage.syncMessage = syncMessage;

  //       const silent = true;

  //       const debugMessageType =
  //         window.textsecure.OutgoingMessage.DebugMessageType.CONTACT_SYNC_SEND;

  //       return this.sendIndividualProto(
  //         primaryDeviceKey,
  //         contentMessage,
  //         Date.now(),
  //         silent,
  //         { debugMessageType } // options
  //       );
  //     });

  //   return Promise.all(syncPromises);
  // },

