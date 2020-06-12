enum MessageModelType {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
  FRIEND_REQUEST = 'friend-request',
}

export enum EndSessionType {
  DONE = 'done',
  ONGOING = 'ongoing',
}

interface MessageAttributes {
  id: number;
  source: string;
  endSessionType: EndSessionType;
  quote: any;
  expireTimer: number;
  received_at: number;
  sent_at: number;
  preview: any;
  body: string;
  expirationStartTimestamp: any;
  read_by: Array<string>;
  delivered_to: Array<string>;
  decrypted_at: number;
  recipients: Array<string>;
  delivered: number;
  friendStatus: any;
  type: MessageModelType;
  group_update: any;
  groupInvitation: any;
  attachments: any;
  contact: any;
  conversationId: any;
  errors: any;
  flags: number;
  hasAttachments: boolean;
  hasFileAttachments: boolean;
  hasVisualMediaAttachments: boolean;
  schemaVersion: number;
  expirationTimerUpdate: any;
  unread: boolean;
  group: any;
  bodyPending: boolean;
}

export interface MessageModel extends Backbone.Model<MessageAttributes> {
  idForLogging: () => string;
  isGroupUpdate: () => boolean;
  isExpirationTimerUpdate: () => boolean;
  isFriendRequest: () => boolean;
  getNotificationText: () => string;
  isEndSession: () => boolean;
  markRead: () => void;
  merge: (other: MessageModel) => void;
}
