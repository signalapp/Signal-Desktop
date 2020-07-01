interface ConversationAttributes {
  members: Array<string>;
  left: boolean;
  expireTimer: number;
  profileSharing: boolean;
  secondaryStatus: boolean;
  mentionedUs: boolean;
  unreadCount: number;
  isArchived: boolean;
  active_at: number;
  timestamp: number; // timestamp of what?
}

export interface ConversationModel
  extends Backbone.Model<ConversationAttributes> {
  idForLogging: () => string;
  saveChangesToDB: () => Promise<void>;
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

  lastMessage: string;
}
