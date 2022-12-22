// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';

import type { PropsType } from './ToastManager';
import enMessages from '../../_locales/en/messages.json';
import { ToastManager } from './ToastManager';
import { ToastType } from '../types/Toast';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ToastManager',
  component: ToastManager,
  argTypes: {
    hideToast: { action: true },
    openFileInFolder: { action: true },
    onUndoArchive: { action: true },
    i18n: {
      defaultValue: i18n,
    },
    toast: {
      defaultValue: undefined,
    },
  },
} as Meta;

// eslint-disable-next-line react/function-component-definition
const Template: Story<PropsType> = args => <ToastManager {...args} />;

export const UndefinedToast = Template.bind({});
UndefinedToast.args = {};

export const InvalidToast = Template.bind({});
InvalidToast.args = {
  toast: {
    toastType: 'this is a toast that does not exist' as ToastType,
  },
};

export const AddingUserToGroup = Template.bind({});
AddingUserToGroup.args = {
  toast: {
    toastType: ToastType.AddingUserToGroup,
    parameters: {
      contact: 'Sam Mirete',
    },
  },
};

export const AlreadyGroupMember = Template.bind({});
AlreadyGroupMember.args = {
  toast: {
    toastType: ToastType.AlreadyGroupMember,
  },
};

export const AlreadyRequestedToJoin = Template.bind({});
AlreadyRequestedToJoin.args = {
  toast: {
    toastType: ToastType.AlreadyRequestedToJoin,
  },
};

export const Blocked = Template.bind({});
Blocked.args = {
  toast: {
    toastType: ToastType.Blocked,
  },
};

export const BlockedGroup = Template.bind({});
BlockedGroup.args = {
  toast: {
    toastType: ToastType.BlockedGroup,
  },
};

export const CannotMixMultiAndNonMultiAttachments = Template.bind({});
CannotMixMultiAndNonMultiAttachments.args = {
  toast: {
    toastType: ToastType.CannotMixMultiAndNonMultiAttachments,
  },
};

export const CannotOpenGiftBadgeIncoming = Template.bind({});
CannotOpenGiftBadgeIncoming.args = {
  toast: {
    toastType: ToastType.CannotOpenGiftBadgeIncoming,
  },
};

export const CannotOpenGiftBadgeOutgoing = Template.bind({});
CannotOpenGiftBadgeOutgoing.args = {
  toast: {
    toastType: ToastType.CannotOpenGiftBadgeOutgoing,
  },
};

export const CannotStartGroupCall = Template.bind({});
CannotStartGroupCall.args = {
  toast: {
    toastType: ToastType.CannotStartGroupCall,
  },
};

export const ConversationArchived = Template.bind({});
ConversationArchived.args = {
  toast: {
    toastType: ToastType.ConversationArchived,
    parameters: {
      conversationId: 'some-conversation-id',
    },
  },
};

export const ConversationMarkedUnread = Template.bind({});
ConversationMarkedUnread.args = {
  toast: {
    toastType: ToastType.ConversationMarkedUnread,
  },
};

export const ConversationUnarchived = Template.bind({});
ConversationUnarchived.args = {
  toast: {
    toastType: ToastType.ConversationUnarchived,
  },
};

export const CopiedUsername = Template.bind({});
CopiedUsername.args = {
  toast: {
    toastType: ToastType.CopiedUsername,
  },
};

export const CopiedUsernameLink = Template.bind({});
CopiedUsernameLink.args = {
  toast: {
    toastType: ToastType.CopiedUsernameLink,
  },
};

export const DangerousFileType = Template.bind({});
DangerousFileType.args = {
  toast: {
    toastType: ToastType.DangerousFileType,
  },
};

export const DeleteForEveryoneFailed = Template.bind({});
DeleteForEveryoneFailed.args = {
  toast: {
    toastType: ToastType.DeleteForEveryoneFailed,
  },
};

export const Error = Template.bind({});
Error.args = {
  toast: {
    toastType: ToastType.Error,
  },
};

export const Expired = Template.bind({});
Expired.args = {
  toast: {
    toastType: ToastType.Expired,
  },
};

export const FailedToDeleteUsername = Template.bind({});
FailedToDeleteUsername.args = {
  toast: {
    toastType: ToastType.FailedToDeleteUsername,
  },
};

export const FileSaved = Template.bind({});
FileSaved.args = {
  toast: {
    toastType: ToastType.FileSaved,
    parameters: {
      fullPath: '/image.png',
    },
  },
};

export const FileSize = Template.bind({});
FileSize.args = {
  toast: {
    toastType: ToastType.FileSize,
    parameters: {
      limit: '100',
      units: 'MB',
    },
  },
};

export const InvalidConversation = Template.bind({});
InvalidConversation.args = {
  toast: {
    toastType: ToastType.InvalidConversation,
  },
};

export const LeftGroup = Template.bind({});
LeftGroup.args = {
  toast: {
    toastType: ToastType.LeftGroup,
  },
};

export const MaxAttachments = Template.bind({});
MaxAttachments.args = {
  toast: {
    toastType: ToastType.MaxAttachments,
  },
};

export const OriginalMessageNotFound = Template.bind({});
OriginalMessageNotFound.args = {
  toast: {
    toastType: ToastType.OriginalMessageNotFound,
  },
};

export const MessageBodyTooLong = Template.bind({});
MessageBodyTooLong.args = {
  toast: {
    toastType: ToastType.MessageBodyTooLong,
  },
};

export const PinnedConversationsFull = Template.bind({});
PinnedConversationsFull.args = {
  toast: {
    toastType: ToastType.PinnedConversationsFull,
  },
};

export const ReactionFailed = Template.bind({});
ReactionFailed.args = {
  toast: {
    toastType: ToastType.ReactionFailed,
  },
};

export const ReportedSpamAndBlocked = Template.bind({});
ReportedSpamAndBlocked.args = {
  toast: {
    toastType: ToastType.ReportedSpamAndBlocked,
  },
};

export const StoryMuted = Template.bind({});
StoryMuted.args = {
  toast: {
    toastType: ToastType.StoryMuted,
  },
};

export const StoryReact = Template.bind({});
StoryReact.args = {
  toast: {
    toastType: ToastType.StoryReact,
  },
};

export const StoryReply = Template.bind({});
StoryReply.args = {
  toast: {
    toastType: ToastType.StoryReply,
  },
};

export const StoryVideoError = Template.bind({});
StoryVideoError.args = {
  toast: {
    toastType: ToastType.StoryVideoError,
  },
};

export const StoryVideoTooLong = Template.bind({});
StoryVideoTooLong.args = {
  toast: {
    toastType: ToastType.StoryVideoTooLong,
  },
};

export const StoryVideoUnsupported = Template.bind({});
StoryVideoUnsupported.args = {
  toast: {
    toastType: ToastType.StoryVideoUnsupported,
  },
};

export const TapToViewExpiredIncoming = Template.bind({});
TapToViewExpiredIncoming.args = {
  toast: {
    toastType: ToastType.TapToViewExpiredIncoming,
  },
};

export const TapToViewExpiredOutgoing = Template.bind({});
TapToViewExpiredOutgoing.args = {
  toast: {
    toastType: ToastType.TapToViewExpiredOutgoing,
  },
};

export const UnableToLoadAttachment = Template.bind({});
UnableToLoadAttachment.args = {
  toast: {
    toastType: ToastType.UnableToLoadAttachment,
  },
};

export const UnsupportedMultiAttachment = Template.bind({});
UnsupportedMultiAttachment.args = {
  toast: {
    toastType: ToastType.UnsupportedMultiAttachment,
  },
};

export const UserAddedToGroup = Template.bind({});
UserAddedToGroup.args = {
  toast: {
    toastType: ToastType.UserAddedToGroup,
    parameters: {
      contact: 'Sam Mirete',
      group: 'Hike Group 🏔',
    },
  },
};
