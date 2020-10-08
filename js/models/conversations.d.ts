import { MessageModel, MessageAttributes } from './messages';

interface ConversationAttributes {
  profileName?: string;
  id: string;
  name: string;
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
  groupAdmins?: Array<string>;
  isKickedFromGroup?: boolean;
  avatarPath?: string;
  isMe?: boolean;
}

export interface ConversationModel
  extends Backbone.Model<ConversationAttributes> {
  idForLogging: () => string;
  // Save model changes to the database
  commit: () => Promise<void>;
  notify: (message: MessageModel) => void;
  isSessionResetReceived: () => boolean;
  updateExpirationTimer: (
    expireTimer: number | null,
    source: string,
    receivedAt: number,
    options: object
  ) => void;
  isPrivate: () => boolean;
  isVerified: () => boolean;
  toggleVerified: () => Promise<void>;
  getProfile: (id: string) => Promise<any>;
  getProfiles: () => Promise<any>;
  setProfileKey: (key: string) => void;
  isMe: () => boolean;
  getRecipients: () => Array<string>;
  getTitle: () => string;
  onReadMessage: (message: MessageModel) => void;
  updateTextInputState: () => void;
  getName: () => string;
  addMessage: (attributes: Partial<MessageAttributes>) => Promise<MessageModel>;
  isMediumGroup: () => boolean;

  lastMessage: string;
  messageCollection: Backbone.Collection<MessageModel>;
}
