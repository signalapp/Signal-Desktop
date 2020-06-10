import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';
import { DataMessage, AttachmentPointer } from '../data';
import { ContactSyncMessage } from '.';

// Matches SyncMessage definition in SignalService protobuf
export enum SyncMessageEnum {
  UNKNONWN = 0,
  CONTACTS = 1,
  GROUPS = 2,
  BLOCKED = 3,
  CONFIGURATION = 4,
}

export type SyncMessageType = ContactSyncMessage; // | GroupSyncMessage

export abstract class SyncMessage extends ContentMessage {
  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected contentProto(): SignalService.Content {
    const dataMessage = new SignalService.DataMessage({});

    return new SignalService.Content({
      dataMessage,
      syncMessage: this.syncProto(),
    });
  }

  protected abstract syncProto(): SignalService.SyncMessage;
}
