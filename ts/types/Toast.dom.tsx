// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum ToastType {
  AddingUserToGroup = 'AddingUserToGroup',
  AddedUsersToCall = 'AddedUsersToCall',
  AlreadyGroupMember = 'AlreadyGroupMember',
  AlreadyRequestedToJoin = 'AlreadyRequestedToJoin',
  AttachmentDownloadFailed = 'AttachmentDownloadFailed',
  AttachmentDownloadStillInProgress = 'AttachmentDownloadStillInProgress',
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
  ChatFolderCreated = 'ChatFolderCreated',
  ChatFolderAddedChat = 'ChatFolderAddedChat',
  ChatFolderRemovedChat = 'ChatFolderRemovedChat',
  ConversationArchived = 'ConversationArchived',
  ConversationMarkedUnread = 'ConversationMarkedUnread',
  ConversationRemoved = 'ConversationRemoved',
  ConversationUnarchived = 'ConversationUnarchived',
  CopiedBackupKey = 'CopiedBackupKey',
  CopiedCallLink = 'CopiedCallLink',
  CopiedUsername = 'CopiedUsername',
  CopiedUsernameLink = 'CopiedUsernameLink',
  DangerousFileType = 'DangerousFileType',
  DecryptionError = 'DecryptionError',
  DebugLogError = 'DebugLogError',
  DeleteForEveryoneFailed = 'DeleteForEveryoneFailed',
  DonationCanceled = 'DonationCanceled',
  DonationCanceledWithView = 'DonationCanceledWithView',
  DonationCompleted = 'DonationCompleted',
  DonationConfirmationNeeded = 'DonationConfirmationNeeded',
  DonationError = 'DonationError',
  DonationProcessing = 'DonationProcessing',
  DonationVerificationNeeded = 'DonationVerificationNeeded',
  DonationVerificationFailed = 'DonationVerificationFailed',
  Error = 'Error',
  Expired = 'Expired',
  FailedToDeleteUsername = 'FailedToDeleteUsername',
  FailedToFetchPhoneNumber = 'FailedToFetchPhoneNumber',
  FailedToFetchUsername = 'FailedToFetchUsername',
  FailedToSendWithEndorsements = 'FailedToSendWithEndorsements',
  FailedToImportBackup = 'FailedToImportBackup',
  FileSaved = 'FileSaved',
  FileSize = 'FileSize',
  GroupLinkCopied = 'GroupLinkCopied',
  InvalidConversation = 'InvalidConversation',
  InvalidStorageServiceHeaders = 'InvalidStorageServiceHeaders',
  LeftGroup = 'LeftGroup',
  LinkCopied = 'LinkCopied',
  LoadingFullLogs = 'LoadingFullLogs',
  _InternalMainProcessLoggingError = '_InternalMainProcessLoggingError',
  MaxAttachments = 'MaxAttachments',
  MediaNoLongerAvailable = 'MediaNoLongerAvailable',
  MessageBodyTooLong = 'MessageBodyTooLong',
  MessageLoop = 'MessageLoop',
  NotificationProfileUpdate = 'NotificationProfileUpdate',
  OriginalMessageNotFound = 'OriginalMessageNotFound',
  PinnedConversationsFull = 'PinnedConversationsFull',
  ReactionFailed = 'ReactionFailed',
  ReceiptSaved = 'ReceiptSaved',
  ReceiptSaveFailed = 'ReceiptSaveFailed',
  ReportedSpam = 'ReportedSpam',
  ReportedSpamAndBlocked = 'ReportedSpamAndBlocked',
  SQLError = 'SQLError',
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
  TransportError = 'TransportError',
  UnableToLoadAttachment = 'UnableToLoadAttachment',
  UnableToDownloadFromBackupTier = 'UnableToDownloadFromBackupTier',
  UnsupportedMultiAttachment = 'UnsupportedMultiAttachment',
  UnsupportedOS = 'UnsupportedOS',
  UserAddedToGroup = 'UserAddedToGroup',
  UsernameRecovered = 'UsernameRecovered',
  VoiceNoteLimit = 'VoiceNoteLimit',
  VoiceNoteMustBeTheOnlyAttachment = 'VoiceNoteMustBeTheOnlyAttachment',
  WhoCanFindMeReadOnly = 'WhoCanFindMeReadOnly',
}

export type AnyToast =
  | { toastType: ToastType.AddingUserToGroup; parameters: { contact: string } }
  | {
      toastType: ToastType.AddedUsersToCall;
      parameters: { count: number };
    }
  | { toastType: ToastType.AlreadyGroupMember }
  | { toastType: ToastType.AlreadyRequestedToJoin }
  | {
      toastType: ToastType.AttachmentDownloadFailed;
      parameters: { messageId: string };
    }
  | {
      toastType: ToastType.AttachmentDownloadStillInProgress;
      parameters: { count: number };
    }
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
      toastType: ToastType.ChatFolderAddedChat;
      parameters: { chatFolderName: string };
    }
  | {
      toastType: ToastType.ChatFolderRemovedChat;
      parameters: { chatFolderName: string };
    }
  | {
      toastType: ToastType.ChatFolderCreated;
      parameters: { chatFolderName: string };
    }
  | {
      toastType: ToastType.ConversationArchived;
      parameters: { conversationId: string; wasPinned: boolean };
    }
  | { toastType: ToastType.ConversationMarkedUnread }
  | { toastType: ToastType.ConversationRemoved; parameters: { title: string } }
  | { toastType: ToastType.ConversationUnarchived }
  | { toastType: ToastType.CopiedBackupKey }
  | { toastType: ToastType.CopiedCallLink }
  | { toastType: ToastType.CopiedUsername }
  | { toastType: ToastType.CopiedUsernameLink }
  | { toastType: ToastType.DangerousFileType }
  | { toastType: ToastType.DebugLogError }
  | { toastType: ToastType.DeleteForEveryoneFailed }
  | { toastType: ToastType.DonationCanceled }
  | { toastType: ToastType.DonationCanceledWithView }
  | { toastType: ToastType.DonationCompleted }
  | { toastType: ToastType.DonationConfirmationNeeded }
  | { toastType: ToastType.DonationError }
  | { toastType: ToastType.DonationProcessing }
  | { toastType: ToastType.DonationVerificationFailed }
  | { toastType: ToastType.DonationVerificationNeeded }
  | { toastType: ToastType.Error }
  | { toastType: ToastType.Expired }
  | { toastType: ToastType.FailedToDeleteUsername }
  | { toastType: ToastType.FailedToFetchPhoneNumber }
  | { toastType: ToastType.FailedToFetchUsername }
  | { toastType: ToastType.FailedToSendWithEndorsements }
  | { toastType: ToastType.FailedToImportBackup }
  | {
      toastType: ToastType.FileSaved;
      parameters: { fullPath: string; countOfFiles?: number };
    }
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
  | { toastType: ToastType.InvalidStorageServiceHeaders }
  | { toastType: ToastType.LeftGroup }
  | { toastType: ToastType.LinkCopied }
  | { toastType: ToastType.LoadingFullLogs }
  | {
      toastType: ToastType._InternalMainProcessLoggingError;
      parameters: { count: number; logLines: Array<string> };
    }
  | { toastType: ToastType.MaxAttachments }
  | { toastType: ToastType.MediaNoLongerAvailable }
  | { toastType: ToastType.MessageBodyTooLong }
  | { toastType: ToastType.MessageLoop }
  | {
      toastType: ToastType.NotificationProfileUpdate;
      parameters: { enabled: boolean; name: string };
    }
  | { toastType: ToastType.OriginalMessageNotFound }
  | { toastType: ToastType.PinnedConversationsFull }
  | { toastType: ToastType.ReactionFailed }
  | {
      toastType: ToastType.ReceiptSaved;
      parameters: { fullPath: string };
    }
  | { toastType: ToastType.ReceiptSaveFailed }
  | { toastType: ToastType.ReportedSpam }
  | { toastType: ToastType.ReportedSpamAndBlocked }
  | { toastType: ToastType.StickerPackInstallFailed }
  | { toastType: ToastType.SQLError }
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
  | { toastType: ToastType.TransportError }
  | { toastType: ToastType.UnableToDownloadFromBackupTier }
  | { toastType: ToastType.UnableToLoadAttachment }
  | { toastType: ToastType.UnsupportedMultiAttachment }
  | { toastType: ToastType.UnsupportedOS }
  | {
      toastType: ToastType.UserAddedToGroup;
      parameters: { contact: string; group: string };
    }
  | {
      toastType: ToastType.UsernameRecovered;
      parameters: { username: string };
    }
  | { toastType: ToastType.VoiceNoteLimit }
  | { toastType: ToastType.VoiceNoteMustBeTheOnlyAttachment }
  | { toastType: ToastType.WhoCanFindMeReadOnly };
