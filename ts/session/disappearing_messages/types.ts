// NOTE this must match Content.ExpirationType in the protobuf
export const DisappearingMessageMode = ['unknown', 'deleteAfterRead', 'deleteAfterSend'] as const;
export type DisappearingMessageType = typeof DisappearingMessageMode[number];
export type DisappearAfterSendOnly = Exclude<DisappearingMessageType, 'deleteAfterRead'>;

// TODO NOTE legacy is strictly used in the UI and is not a valid disappearing message mode
export const DisappearingMessageConversationModes = [
  'off',
  DisappearingMessageMode[1], // deleteAfterRead
  DisappearingMessageMode[2], // deleteAfterSend
  // TODO legacy messages support will be removed in a future release
  'legacy',
] as const;
export type DisappearingMessageConversationModeType = typeof DisappearingMessageConversationModes[number]; // TODO we should make this type a bit more hardcoded than being just resolved as a string

// TODO legacy messages support will be removed in a future release
// expirationType and lastDisappearingMessageChangeTimestamp will no longer have an undefined option
/** Used for setting disappearing messages in conversations */
export type ExpirationTimerUpdate = {
  expirationType: DisappearingMessageType | undefined;
  expireTimer: number;
  lastDisappearingMessageChangeTimestamp: number | undefined;
  source: string;
  /** updated setting from another device */
  fromSync?: boolean;
};

export type DisappearingMessageUpdate = {
  expirationType: DisappearingMessageType;
  expirationTimer: number;
  // This is used for the expirationTimerUpdate
  lastDisappearingMessageChangeTimestamp?: number;
  // TODO legacy messages support will be removed in a future release
  isLegacyConversationSettingMessage?: boolean;
  isLegacyDataMessage?: boolean;
  isDisappearingMessagesV2Released?: boolean;
  shouldDisappearButIsntMessage?: boolean;
  isOutdated?: boolean;
};
