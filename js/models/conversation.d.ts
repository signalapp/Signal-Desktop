interface ConversationAttributes {
  members: Array<string>;
  left: boolean;
  expireTimer: number;
  profileSharing: boolean;
  mentionedUs: boolean;
  unreadCount: number;
  isArchived: boolean;
  active_at: number;
  timestamp: number; // timestamp of what?
}

export interface ConversationModel
  extends Backbone.Model<ConversationAttributes> {
  setFriendRequestStatus: (status: any) => Promise<void>;
  idForLogging: () => string;
  saveChangesToDB: () => Promise<void>;
  notifyFriendRequest: (source: string, type: string) => Promise<void>;
  notify: (message: MessageModel) => void;
  isSessionResetReceived: () => boolean;
  updateExpirationTimer: (
    expireTimer: number | null,
    source: string,
    receivedAt: number,
    options: object
  ) => void;
  isPrivate: () => boolean;
  setProfileKey: (key: string) => void;
  isMe: () => boolean;
  getRecipients: () => Array<string>;
  onReadMessage: (message: MessageModel) => void;
  updateTextInputState: () => void;
  isFriend: () => boolean;
  hasSentFriendRequest: () => boolean;
  onFriendRequestAccepted: () => Promise<void>;
  onFriendRequestReceived: () => Promise<void>;

  lastMessage: string;
}
