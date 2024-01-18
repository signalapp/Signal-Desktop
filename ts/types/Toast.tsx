// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum ToastType {
  AddingUserToGroup = 'AddingUserToGroup',
  AlreadyGroupMember = 'AlreadyGroupMember',
  AlreadyRequestedToJoin = 'AlreadyRequestedToJoin',
  Blocked = 'Blocked',
  BlockedGroup = 'BlockedGroup',
  CallHistoryCleared = 'CallHistoryCleared',
  CannotEditMessage = 'CannotEditMessage',
  CannotForwardEmptyMessage = 'CannotForwardEmptyMessage',
  CannotMixMultiAndNonMultiAttachments = 'CannotMixMultiAndNonMultiAttachments',
  CannotOpenGiftBadgeIncoming = 'CannotOpenGiftBadgeIncoming',
  CannotOpenGiftBadgeOutgoing = 'CannotOpenGiftBadgeOutgoing',
  CannotStartGroupCall = 'CannotStartGroupCall',
  ConversationArchived = 'ConversationArchived',
  ConversationMarkedUnread = 'ConversationMarkedUnread',
  ConversationRemoved = 'ConversationRemoved',
  ConversationUnarchived = 'ConversationUnarchived',
  CopiedUsername = 'CopiedUsername',
  CopiedUsernameLink = 'CopiedUsernameLink',
  DangerousFileType = 'DangerousFileType',
  DeleteForEveryoneFailed = 'DeleteForEveryoneFailed',
  Error = 'Error',
  Expired = 'Expired',
  FailedToDeleteUsername = 'FailedToDeleteUsername',
  FileSaved = 'FileSaved',
  FileSize = 'FileSize',
  InvalidConversation = 'InvalidConversation',
  LeftGroup = 'LeftGroup',
  MaxAttachments = 'MaxAttachments',
  MessageBodyTooLong = 'MessageBodyTooLong',
  OriginalMessageNotFound = 'OriginalMessageNotFound',
  PinnedConversationsFull = 'PinnedConversationsFull',
  ReactionFailed = 'ReactionFailed',
  ReportedSpamAndBlocked = 'ReportedSpamAndBlocked',
  StoryMuted = 'StoryMuted',
  StoryReact = 'StoryReact',
  StoryReply = 'StoryReply',
  StoryVideoError = 'StoryVideoError',
  StoryVideoUnsupported = 'StoryVideoUnsupported',
  TapToViewExpiredIncoming = 'TapToViewExpiredIncoming',
  TapToViewExpiredOutgoing = 'TapToViewExpiredOutgoing',
  TooManyMessagesToDeleteForEveryone = 'TooManyMessagesToDeleteForEveryone',
  TooManyMessagesToForward = 'TooManyMessagesToForward',
  UnableToLoadAttachment = 'UnableToLoadAttachment',
  UnsupportedMultiAttachment = 'UnsupportedMultiAttachment',
  UnsupportedOS = 'UnsupportedOS',
  UserAddedToGroup = 'UserAddedToGroup',
  WhoCanFindMeReadOnly = 'WhoCanFindMeReadOnly',
}

export type AnyToast =
  | { toastType: ToastType.AddingUserToGroup; parameters: { contact: string } }
  | { toastType: ToastType.AlreadyGroupMember }
  | { toastType: ToastType.AlreadyRequestedToJoin }
  | { toastType: ToastType.Blocked }
  | { toastType: ToastType.BlockedGroup }
  | { toastType: ToastType.CallHistoryCleared }
  | { toastType: ToastType.CannotEditMessage }
  | { toastType: ToastType.CannotForwardEmptyMessage }
  | { toastType: ToastType.CannotMixMultiAndNonMultiAttachments }
  | { toastType: ToastType.CannotOpenGiftBadgeIncoming }
  | { toastType: ToastType.CannotOpenGiftBadgeOutgoing }
  | { toastType: ToastType.CannotStartGroupCall }
  | {
      toastType: ToastType.ConversationArchived;
      parameters: { conversationId: string };
    }
  | { toastType: ToastType.ConversationMarkedUnread }
  | { toastType: ToastType.ConversationRemoved; parameters: { title: string } }
  | { toastType: ToastType.ConversationUnarchived }
  | { toastType: ToastType.CopiedUsername }
  | { toastType: ToastType.CopiedUsernameLink }
  | { toastType: ToastType.DangerousFileType }
  | { toastType: ToastType.DeleteForEveryoneFailed }
  | { toastType: ToastType.Error }
  | { toastType: ToastType.Expired }
  | { toastType: ToastType.FailedToDeleteUsername }
  | { toastType: ToastType.FileSaved; parameters: { fullPath: string } }
  | {
      toastType: ToastType.FileSize;
      parameters: { limit: number; units: string };
    }
  | { toastType: ToastType.InvalidConversation }
  | { toastType: ToastType.LeftGroup }
  | { toastType: ToastType.MaxAttachments }
  | { toastType: ToastType.MessageBodyTooLong }
  | { toastType: ToastType.OriginalMessageNotFound }
  | { toastType: ToastType.PinnedConversationsFull }
  | { toastType: ToastType.ReactionFailed }
  | { toastType: ToastType.ReportedSpamAndBlocked }
  | { toastType: ToastType.StoryMuted }
  | { toastType: ToastType.StoryReact }
  | { toastType: ToastType.StoryReply }
  | { toastType: ToastType.StoryVideoError }
  | { toastType: ToastType.StoryVideoUnsupported }
  | { toastType: ToastType.TapToViewExpiredIncoming }
  | { toastType: ToastType.TapToViewExpiredOutgoing }
  | {
      toastType: ToastType.TooManyMessagesToDeleteForEveryone;
      parameters: { count: number };
    }
  | { toastType: ToastType.TooManyMessagesToForward }
  | { toastType: ToastType.UnableToLoadAttachment }
  | { toastType: ToastType.UnsupportedMultiAttachment }
  | { toastType: ToastType.UnsupportedOS }
  | {
      toastType: ToastType.UserAddedToGroup;
      parameters: { contact: string; group: string };
    }
  | { toastType: ToastType.WhoCanFindMeReadOnly };
