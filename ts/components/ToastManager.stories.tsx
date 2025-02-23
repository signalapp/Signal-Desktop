// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { action } from '@storybook/addon-actions';
import enMessages from '../../_locales/en/messages.json';
import { ToastManager } from './ToastManager';
import type { AnyToast } from '../types/Toast';
import { ToastType } from '../types/Toast';
import type { AnyActionableMegaphone } from '../types/Megaphone';
import { MegaphoneType } from '../types/Megaphone';
import { setupI18n } from '../util/setupI18n';
import { missingCaseError } from '../util/missingCaseError';
import type { PropsType } from './ToastManager';

const i18n = setupI18n('en', enMessages);

function getToast(toastType: ToastType): AnyToast {
  switch (toastType) {
    case ToastType.AddingUserToGroup:
      return { toastType, parameters: { contact: 'Sam Mirete' } };
    case ToastType.AddedUsersToCall:
      return { toastType, parameters: { count: 6 } };
    case ToastType.AlreadyGroupMember:
      return { toastType: ToastType.AlreadyGroupMember };
    case ToastType.AlreadyRequestedToJoin:
      return { toastType: ToastType.AlreadyRequestedToJoin };
    case ToastType.AttachmentDownloadStillInProgress:
      return {
        toastType: ToastType.AttachmentDownloadStillInProgress,
        parameters: {
          count: 1,
        },
      };
    case ToastType.Blocked:
      return { toastType: ToastType.Blocked };
    case ToastType.BlockedGroup:
      return { toastType: ToastType.BlockedGroup };
    case ToastType.CallHistoryCleared:
      return { toastType: ToastType.CallHistoryCleared };
    case ToastType.CannotEditMessage:
      return { toastType: ToastType.CannotEditMessage };
    case ToastType.CannotForwardEmptyMessage:
      return { toastType: ToastType.CannotForwardEmptyMessage };
    case ToastType.CannotMixMultiAndNonMultiAttachments:
      return { toastType: ToastType.CannotMixMultiAndNonMultiAttachments };
    case ToastType.CannotOpenGiftBadgeIncoming:
      return { toastType: ToastType.CannotOpenGiftBadgeIncoming };
    case ToastType.CannotOpenGiftBadgeOutgoing:
      return { toastType: ToastType.CannotOpenGiftBadgeOutgoing };
    case ToastType.CannotStartGroupCall:
      return { toastType: ToastType.CannotStartGroupCall };
    case ToastType.CaptchaFailed:
      return { toastType: ToastType.CaptchaFailed };
    case ToastType.CaptchaSolved:
      return { toastType: ToastType.CaptchaSolved };
    case ToastType.ConversationArchived:
      return {
        toastType: ToastType.ConversationArchived,
        parameters: {
          conversationId: 'some-conversation-id',
          wasPinned: false,
        },
      };
    case ToastType.ConversationMarkedUnread:
      return { toastType: ToastType.ConversationMarkedUnread };
    case ToastType.ConversationRemoved:
      return {
        toastType: ToastType.ConversationRemoved,
        parameters: { title: 'Alice' },
      };
    case ToastType.ConversationUnarchived:
      return { toastType: ToastType.ConversationUnarchived };
    case ToastType.CopiedCallLink:
      return { toastType: ToastType.CopiedCallLink };
    case ToastType.CopiedUsername:
      return { toastType: ToastType.CopiedUsername };
    case ToastType.CopiedUsernameLink:
      return { toastType: ToastType.CopiedUsernameLink };
    case ToastType.DangerousFileType:
      return { toastType: ToastType.DangerousFileType };
    case ToastType.DebugLogError:
      return { toastType: ToastType.DebugLogError };
    case ToastType.DecryptionError:
      return {
        toastType: ToastType.DecryptionError,
        parameters: {
          deviceId: 2,
          name: 'Alice',
        },
      };
    case ToastType.DeleteForEveryoneFailed:
      return { toastType: ToastType.DeleteForEveryoneFailed };
    case ToastType.Error:
      return { toastType: ToastType.Error };
    case ToastType.Expired:
      return { toastType: ToastType.Expired };
    case ToastType.FailedToDeleteUsername:
      return { toastType: ToastType.FailedToDeleteUsername };
    case ToastType.FailedToFetchPhoneNumber:
      return { toastType: ToastType.FailedToFetchPhoneNumber };
    case ToastType.FailedToFetchUsername:
      return { toastType: ToastType.FailedToFetchUsername };
    case ToastType.FailedToSendWithEndorsements:
      return { toastType: ToastType.FailedToSendWithEndorsements };
    case ToastType.FailedToImportBackup:
      return { toastType: ToastType.FailedToImportBackup };
    case ToastType.FileSaved:
      return {
        toastType: ToastType.FileSaved,
        parameters: { fullPath: '/image.png' },
      };
    case ToastType.FileSize:
      return {
        toastType: ToastType.FileSize,
        parameters: { limit: 100, units: 'MB' },
      };
    case ToastType.GroupLinkCopied:
      return { toastType: ToastType.GroupLinkCopied };
    case ToastType.InvalidConversation:
      return { toastType: ToastType.InvalidConversation };
    case ToastType.InvalidStorageServiceHeaders:
      return { toastType: ToastType.InvalidStorageServiceHeaders };
    case ToastType.LeftGroup:
      return { toastType: ToastType.LeftGroup };
    case ToastType.LinkCopied:
      return { toastType: ToastType.LinkCopied };
    case ToastType.LoadingFullLogs:
      return { toastType: ToastType.LoadingFullLogs };
    case ToastType.MaxAttachments:
      return { toastType: ToastType.MaxAttachments };
    case ToastType.MediaNoLongerAvailable:
      return { toastType: ToastType.MediaNoLongerAvailable };
    case ToastType.MessageBodyTooLong:
      return { toastType: ToastType.MessageBodyTooLong };
    case ToastType.MessageLoop:
      return { toastType: ToastType.MessageLoop };
    case ToastType.OriginalMessageNotFound:
      return { toastType: ToastType.OriginalMessageNotFound };
    case ToastType.PinnedConversationsFull:
      return { toastType: ToastType.PinnedConversationsFull };
    case ToastType.ReactionFailed:
      return { toastType: ToastType.ReactionFailed };
    case ToastType.ReportedSpam:
      return { toastType: ToastType.ReportedSpam };
    case ToastType.ReportedSpamAndBlocked:
      return { toastType: ToastType.ReportedSpamAndBlocked };
    case ToastType.StickerPackInstallFailed:
      return { toastType: ToastType.StickerPackInstallFailed };
    case ToastType.StoryMuted:
      return { toastType: ToastType.StoryMuted };
    case ToastType.StoryReact:
      return { toastType: ToastType.StoryReact };
    case ToastType.StoryReply:
      return { toastType: ToastType.StoryReply };
    case ToastType.StoryVideoError:
      return { toastType: ToastType.StoryVideoError };
    case ToastType.StoryVideoUnsupported:
      return { toastType: ToastType.StoryVideoUnsupported };
    case ToastType.TapToViewExpiredIncoming:
      return { toastType: ToastType.TapToViewExpiredIncoming };
    case ToastType.TapToViewExpiredOutgoing:
      return { toastType: ToastType.TapToViewExpiredOutgoing };
    case ToastType.TransportError:
      return { toastType: ToastType.TransportError };
    case ToastType.TooManyMessagesToDeleteForEveryone:
      return {
        toastType: ToastType.TooManyMessagesToDeleteForEveryone,
        parameters: { count: 30 },
      };
    case ToastType.TooManyMessagesToForward:
      return { toastType: ToastType.TooManyMessagesToForward };
    case ToastType.UnableToLoadAttachment:
      return { toastType: ToastType.UnableToLoadAttachment };
    case ToastType.UnsupportedMultiAttachment:
      return { toastType: ToastType.UnsupportedMultiAttachment };
    case ToastType.UnsupportedOS:
      return { toastType: ToastType.UnsupportedOS };
    case ToastType.UsernameRecovered:
      return {
        toastType: ToastType.UsernameRecovered,
        parameters: {
          username: 'maya.45',
        },
      };
    case ToastType.UserAddedToGroup:
      return {
        toastType: ToastType.UserAddedToGroup,
        parameters: {
          contact: 'Sam Mirete',
          group: 'Hike Group 🏔',
        },
      };
    case ToastType.VoiceNoteLimit:
      return { toastType: ToastType.VoiceNoteLimit };
    case ToastType.VoiceNoteMustBeTheOnlyAttachment:
      return { toastType: ToastType.VoiceNoteMustBeTheOnlyAttachment };
    case ToastType.WhoCanFindMeReadOnly:
      return { toastType: ToastType.WhoCanFindMeReadOnly };
    default:
      throw missingCaseError(toastType);
  }
}

function getMegaphone(megaphoneType: MegaphoneType): AnyActionableMegaphone {
  switch (megaphoneType) {
    case MegaphoneType.UsernameOnboarding:
      return {
        type: megaphoneType,
        onLearnMore: action('onLearnMore'),
        onDismiss: action('onDismiss'),
      };
    default:
      throw missingCaseError(megaphoneType);
  }
}

type Args = Omit<PropsType, 'toast' | 'megaphone'> & {
  toastType: ToastType;
  megaphoneType: MegaphoneType;
};

export default {
  title: 'Components/ToastManager',
  component: ToastManager,
  argTypes: {
    toastType: {
      options: [...Object.values(ToastType)],
      control: { type: 'select' },
    },
    megaphoneType: {
      options: [...Object.values(MegaphoneType)],
      control: { type: 'select' },
    },
  },
  args: {
    hideToast: action('hideToast'),
    openFileInFolder: action('openFileInFolder'),
    onShowDebugLog: action('onShowDebugLog'),
    onUndoArchive: action('onUndoArchive'),
    showAttachmentNotAvailableModal: action('showAttachmentNotAvailableModal'),
    i18n,
    toastType: ToastType.AddingUserToGroup,
    megaphoneType: MegaphoneType.UsernameOnboarding,
    OS: 'macOS',
    isInFullScreenCall: false,
  },
} satisfies Meta<Args>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<Args> = args => {
  const { toastType, megaphoneType, ...rest } = args;
  return (
    <>
      <p>Select a toast type in controls</p>
      <ToastManager
        toast={getToast(toastType)}
        megaphone={getMegaphone(megaphoneType)}
        {...rest}
      />
    </>
  );
};

export const BasicUsage = Template.bind({});
