// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum ToastType {
  AddingUserToGroup = 'AddingUserToGroup',
  AlreadyGroupMember = 'AlreadyGroupMember',
  AlreadyRequestedToJoin = 'AlreadyRequestedToJoin',
  Blocked = 'Blocked',
  BlockedGroup = 'BlockedGroup',
  CallHistoryCleared = 'CallHistoryCleared',
  CaptchaFailed = 'CaptchaFailed',
  CaptchaSolved = 'CaptchaSolved',
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
  DecryptionError = 'DecryptionError',
  DebugLogError = 'DebugLogError',
  DeleteForEveryoneFailed = 'DeleteForEveryoneFailed',
  Error = 'Error',
  Expired = 'Expired',
  FailedToDeleteUsername = 'FailedToDeleteUsername',
  FailedToFetchPhoneNumber = 'FailedToFetchPhoneNumber',
  FailedToFetchUsername = 'FailedToFetchUsername',
  FileSaved = 'FileSaved',
  FileSize = 'FileSize',
  GroupLinkCopied = 'GroupLinkCopied',
  InvalidConversation = 'InvalidConversation',
  LeftGroup = 'LeftGroup',
  LinkCopied = 'LinkCopied',
  LoadingFullLogs = 'LoadingFullLogs',
  MaxAttachments = 'MaxAttachments',
  MessageBodyTooLong = 'MessageBodyTooLong',
  OriginalMessageNotFound = 'OriginalMessageNotFound',
  PinnedConversationsFull = 'PinnedConversationsFull',
  ReactionFailed = 'ReactionFailed',
  ReportedSpamAndBlocked = 'ReportedSpamAndBlocked',
  StickerPackInstallFailed = 'StickerPackInstallFailed',
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
  VoiceNoteLimit = 'VoiceNoteLimit',
  VoiceNoteMustBeTheOnlyAttachment = 'VoiceNoteMustBeTheOnlyAttachment',
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
  | { toastType: ToastType.CaptchaFailed }
  | { toastType: ToastType.CaptchaSolved }
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
  | { toastType: ToastType.DebugLogError }
  | { toastType: ToastType.DeleteForEveryoneFailed }
  | { toastType: ToastType.Error }
  | { toastType: ToastType.Expired }
  | { toastType: ToastType.FailedToDeleteUsername }
  | { toastType: ToastType.FailedToFetchPhoneNumber }
  | { toastType: ToastType.FailedToFetchUsername }
  | { toastType: ToastType.FileSaved; parameters: { fullPath: string } }
  | {
      toastType: ToastType.FileSize;
      parameters: { limit: number; units: string };
    }
  | { toastType: ToastType.GroupLinkCopied }
  | {
      toastType: ToastType.DecryptionError;
      parameters: {
        name: string;
        deviceId: number;
      };
    }
  | { toastType: ToastType.InvalidConversation }
  | { toastType: ToastType.LeftGroup }
  | { toastType: ToastType.LinkCopied }
  | { toastType: ToastType.LoadingFullLogs }
  | { toastType: ToastType.MaxAttachments }
  | { toastType: ToastType.MessageBodyTooLong }
  | { toastType: ToastType.OriginalMessageNotFound }
  | { toastType: ToastType.PinnedConversationsFull }
  | { toastType: ToastType.ReactionFailed }
  | { toastType: ToastType.ReportedSpamAndBlocked }
  | { toastType: ToastType.StickerPackInstallFailed }
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
  | { toastType: ToastType.VoiceNoteLimit }
  | { toastType: ToastType.VoiceNoteMustBeTheOnlyAttachment }
  | { toastType: ToastType.WhoCanFindMeReadOnly };
