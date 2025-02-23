// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import React from 'react';
import { createPortal } from 'react-dom';

import type { LocalizerType } from '../types/Util';
import { SECOND } from '../util/durations';
import { Toast } from './Toast';
import { WidthBreakpoint } from './_util';
import { UsernameMegaphone } from './UsernameMegaphone';
import { assertDev } from '../util/assert';
import { missingCaseError } from '../util/missingCaseError';
import type { AnyToast } from '../types/Toast';
import { ToastType } from '../types/Toast';
import type { AnyActionableMegaphone } from '../types/Megaphone';
import { MegaphoneType } from '../types/Megaphone';
import { AttachmentNotAvailableModalType } from './AttachmentNotAvailableModal';

export type PropsType = {
  hideToast: () => unknown;
  i18n: LocalizerType;
  openFileInFolder: (target: string) => unknown;
  OS: string;
  onShowDebugLog: () => unknown;
  onUndoArchive: (
    conversationId: string,
    options?: { wasPinned?: boolean }
  ) => unknown;
  showAttachmentNotAvailableModal: (
    type: AttachmentNotAvailableModalType
  ) => void;
  toast?: AnyToast;
  megaphone?: AnyActionableMegaphone;
  centerToast?: boolean;
  containerWidthBreakpoint: WidthBreakpoint | null;
  isCompositionAreaVisible?: boolean;
  isInFullScreenCall: boolean;
};

const SHORT_TIMEOUT = 3 * SECOND;

export function renderToast({
  hideToast,
  i18n,
  openFileInFolder,
  onShowDebugLog,
  onUndoArchive,
  showAttachmentNotAvailableModal,
  OS,
  toast,
}: PropsType): JSX.Element | null {
  if (toast === undefined) {
    return null;
  }

  const { toastType } = toast;

  if (toastType === ToastType.AddingUserToGroup) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n('icu:AddUserToAnotherGroupModal__toast--adding-user-to-group', {
          contact: toast.parameters.contact,
        })}
      </Toast>
    );
  }

  if (toastType === ToastType.AddedUsersToCall) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n('icu:CallingPendingParticipants__Toast--added-users-to-call', {
          count: toast.parameters.count,
        })}
      </Toast>
    );
  }

  if (toastType === ToastType.AlreadyGroupMember) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:GroupV2--join--already-in-group')}
      </Toast>
    );
  }

  if (toastType === ToastType.AlreadyRequestedToJoin) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:GroupV2--join--already-awaiting-approval')}
      </Toast>
    );
  }

  if (toastType === ToastType.AttachmentDownloadStillInProgress) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:attachmentStillDownloading', {
          count: toast.parameters.count,
        })}
      </Toast>
    );
  }

  if (toastType === ToastType.Blocked) {
    return <Toast onClose={hideToast}>{i18n('icu:unblockToSend')}</Toast>;
  }

  if (toastType === ToastType.BlockedGroup) {
    return <Toast onClose={hideToast}>{i18n('icu:unblockGroupToSend')}</Toast>;
  }

  if (toastType === ToastType.CallHistoryCleared) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:CallsTab__ToastCallHistoryCleared')}
      </Toast>
    );
  }

  if (toastType === ToastType.CannotEditMessage) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:ToastManager__CannotEditMessage_24')}
      </Toast>
    );
  }

  if (toastType === ToastType.CannotForwardEmptyMessage) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:ForwardMessagesModal__toast--CannotForwardEmptyMessage')}
      </Toast>
    );
  }

  if (toastType === ToastType.CannotMixMultiAndNonMultiAttachments) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:cannotSelectPhotosAndVideosAlongWithFiles')}
      </Toast>
    );
  }

  if (toastType === ToastType.CannotOpenGiftBadgeIncoming) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:message--donation--unopened--toast--incoming')}
      </Toast>
    );
  }

  if (toastType === ToastType.CannotOpenGiftBadgeOutgoing) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:message--donation--unopened--toast--outgoing')}
      </Toast>
    );
  }

  if (toastType === ToastType.CaptchaFailed) {
    return <Toast onClose={hideToast}>{i18n('icu:verificationFailed')}</Toast>;
  }

  if (toastType === ToastType.CaptchaSolved) {
    return (
      <Toast onClose={hideToast}>{i18n('icu:verificationComplete')}</Toast>
    );
  }

  if (toastType === ToastType.CannotStartGroupCall) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:GroupV2--cannot-start-group-call')}
      </Toast>
    );
  }

  if (toastType === ToastType.ConversationArchived) {
    return (
      <Toast
        onClose={hideToast}
        toastAction={{
          label: i18n('icu:conversationArchivedUndo'),
          onClick: () => {
            onUndoArchive(String(toast.parameters.conversationId), {
              wasPinned: toast.parameters.wasPinned,
            });
          },
        }}
      >
        {i18n('icu:conversationArchived')}
      </Toast>
    );
  }

  if (toastType === ToastType.ConversationMarkedUnread) {
    return (
      <Toast onClose={hideToast}>{i18n('icu:conversationMarkedUnread')}</Toast>
    );
  }

  if (toastType === ToastType.ConversationRemoved) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:Toast--ConversationRemoved', {
          title: toast.parameters.title,
        })}
      </Toast>
    );
  }

  if (toastType === ToastType.ConversationUnarchived) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:conversationReturnedToInbox')}
      </Toast>
    );
  }

  if (toastType === ToastType.CopiedCallLink) {
    return (
      <Toast onClose={hideToast} timeout={3 * SECOND}>
        {i18n('icu:calling__call-link-copied')}
      </Toast>
    );
  }

  if (toastType === ToastType.CopiedUsername) {
    return (
      <Toast onClose={hideToast} timeout={3 * SECOND}>
        {i18n('icu:ProfileEditor--username--copied-username')}
      </Toast>
    );
  }

  if (toastType === ToastType.CopiedUsernameLink) {
    return (
      <Toast onClose={hideToast} timeout={3 * SECOND}>
        {i18n('icu:ProfileEditor--username--copied-username-link')}
      </Toast>
    );
  }

  if (toastType === ToastType.DangerousFileType) {
    return <Toast onClose={hideToast}>{i18n('icu:dangerousFileType')}</Toast>;
  }

  if (toastType === ToastType.DebugLogError) {
    return <Toast onClose={hideToast}>{i18n('icu:debugLogError')}</Toast>;
  }

  if (toastType === ToastType.DeleteForEveryoneFailed) {
    return (
      <Toast onClose={hideToast}>{i18n('icu:deleteForEveryoneFailed')}</Toast>
    );
  }

  if (toastType === ToastType.Error) {
    return (
      <Toast
        autoDismissDisabled
        onClose={hideToast}
        toastAction={{
          label: i18n('icu:Toast--error--action'),
          onClick: () => window.IPC.showDebugLog(),
        }}
      >
        {i18n('icu:Toast--error')}
      </Toast>
    );
  }

  if (toastType === ToastType.Expired) {
    return <Toast onClose={hideToast}>{i18n('icu:expiredWarning')}</Toast>;
  }

  if (toastType === ToastType.FailedToDeleteUsername) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:ProfileEditor--username--delete-general-error')}
      </Toast>
    );
  }

  if (toastType === ToastType.FailedToFetchPhoneNumber) {
    return (
      <Toast onClose={hideToast} style={{ maxWidth: '280px' }}>
        {i18n('icu:Toast--failed-to-fetch-phone-number')}
      </Toast>
    );
  }

  if (toastType === ToastType.FailedToFetchUsername) {
    return (
      <Toast onClose={hideToast} style={{ maxWidth: '280px' }}>
        {i18n('icu:Toast--failed-to-fetch-username')}
      </Toast>
    );
  }

  if (toastType === ToastType.FailedToSendWithEndorsements) {
    return (
      <Toast
        onClose={hideToast}
        toastAction={{
          label: i18n('icu:Toast__ActionLabel--SubmitLog'),
          onClick: onShowDebugLog,
        }}
      >
        {i18n('icu:Toast--FailedToSendWithEndorsements')}
      </Toast>
    );
  }

  if (toastType === ToastType.FailedToImportBackup) {
    return (
      <Toast
        onClose={hideToast}
        toastAction={{
          label: i18n('icu:Toast__ActionLabel--SubmitLog'),
          onClick: onShowDebugLog,
        }}
      >
        {i18n('icu:Toast--FailedToImportBackup')}
      </Toast>
    );
  }

  if (toastType === ToastType.InvalidStorageServiceHeaders) {
    return (
      <Toast
        onClose={hideToast}
        toastAction={{
          label: i18n('icu:Toast__ActionLabel--SubmitLog'),
          onClick: onShowDebugLog,
        }}
      >
        {i18n('icu:Toast--InvalidStorageServiceHeaders')}
      </Toast>
    );
  }

  if (toastType === ToastType.FileSaved) {
    return (
      <Toast
        onClose={hideToast}
        toastAction={{
          label: i18n('icu:attachmentSavedShow'),
          onClick: () => {
            openFileInFolder(toast.parameters.fullPath);
          },
        }}
      >
        {i18n('icu:attachmentSavedPlural', {
          count: toast.parameters.countOfFiles ?? 1,
        })}
      </Toast>
    );
  }

  if (toastType === ToastType.FileSize) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:fileSizeWarning', {
          limit: toast.parameters.limit,
          units: toast.parameters.units,
        })}
      </Toast>
    );
  }

  if (toastType === ToastType.GroupLinkCopied) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:GroupLinkManagement--clipboard')}
      </Toast>
    );
  }

  if (toastType === ToastType.DecryptionError) {
    assertDev(
      toast.toastType === ToastType.DecryptionError,
      'Pacify typescript'
    );
    const { parameters } = toast;
    const { deviceId, name } = parameters;

    return (
      <Toast
        autoDismissDisabled
        className="internal-error-toast"
        onClose={hideToast}
        style={{ maxWidth: '500px' }}
        toastAction={{
          label: i18n('icu:Toast__ActionLabel--SubmitLog'),
          onClick: onShowDebugLog,
        }}
      >
        {i18n('icu:decryptionErrorToast', {
          name,
          deviceId: String(deviceId),
        })}
      </Toast>
    );
  }

  if (toastType === ToastType.InvalidConversation) {
    return <Toast onClose={hideToast}>{i18n('icu:invalidConversation')}</Toast>;
  }

  if (toastType === ToastType.LeftGroup) {
    return <Toast onClose={hideToast}>{i18n('icu:youLeftTheGroup')}</Toast>;
  }

  if (toastType === ToastType.LinkCopied) {
    return <Toast onClose={hideToast}>{i18n('icu:debugLogLinkCopied')}</Toast>;
  }

  if (toastType === ToastType.LoadingFullLogs) {
    return <Toast onClose={hideToast}>{i18n('icu:loading')}</Toast>;
  }

  if (toastType === ToastType.MaxAttachments) {
    return <Toast onClose={hideToast}>{i18n('icu:maximumAttachments')}</Toast>;
  }

  if (toastType === ToastType.MediaNoLongerAvailable) {
    return (
      <Toast
        onClose={hideToast}
        toastAction={{
          label: i18n('icu:attachmentNoLongerAvailable__learnMore'),
          onClick: () =>
            showAttachmentNotAvailableModal(
              AttachmentNotAvailableModalType.VisualMedia
            ),
        }}
      >
        {i18n('icu:mediaNotAvailable')}
      </Toast>
    );
  }

  if (toastType === ToastType.MessageBodyTooLong) {
    return <Toast onClose={hideToast}>{i18n('icu:messageBodyTooLong')}</Toast>;
  }

  if (toastType === ToastType.MessageLoop) {
    return (
      <Toast
        onClose={hideToast}
        toastAction={{
          label: i18n('icu:Toast__ActionLabel--SubmitLog'),
          onClick: onShowDebugLog,
        }}
      >
        {i18n('icu:messageLoop')}
      </Toast>
    );
  }

  if (toastType === ToastType.OriginalMessageNotFound) {
    return (
      <Toast onClose={hideToast}>{i18n('icu:originalMessageNotFound')}</Toast>
    );
  }

  if (toastType === ToastType.PinnedConversationsFull) {
    return (
      <Toast onClose={hideToast}>{i18n('icu:pinnedConversationsFull')}</Toast>
    );
  }

  if (toastType === ToastType.ReactionFailed) {
    return <Toast onClose={hideToast}>{i18n('icu:Reactions--error')}</Toast>;
  }

  if (toastType === ToastType.ReportedSpam) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:MessageRequests--report-spam-success-toast')}
      </Toast>
    );
  }

  if (toastType === ToastType.ReportedSpamAndBlocked) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:MessageRequests--block-and-report-spam-success-toast')}
      </Toast>
    );
  }

  if (toastType === ToastType.StickerPackInstallFailed) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:stickers--toast--InstallFailed')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryMuted) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n('icu:Stories__toast--hasNoSound')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryReact) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n('icu:Stories__toast--sending-reaction')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryReply) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n('icu:Stories__toast--sending-reply')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryVideoError) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:StoryCreator__error--video-error')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryVideoUnsupported) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:StoryCreator__error--video-unsupported')}
      </Toast>
    );
  }

  if (toastType === ToastType.TapToViewExpiredIncoming) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:Message--tap-to-view--incoming--expired-toast')}
      </Toast>
    );
  }

  if (toastType === ToastType.TapToViewExpiredOutgoing) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:Message--tap-to-view--outgoing--expired-toast')}
      </Toast>
    );
  }

  if (toastType === ToastType.TooManyMessagesToDeleteForEveryone) {
    return (
      <Toast onClose={hideToast}>
        {i18n(
          'icu:DeleteMessagesModal__toast--TooManyMessagesToDeleteForEveryone',
          { count: toast.parameters.count }
        )}
      </Toast>
    );
  }

  if (toastType === ToastType.TooManyMessagesToForward) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:SelectModeActions__toast--TooManyMessagesToForward')}
      </Toast>
    );
  }

  if (toastType === ToastType.TransportError) {
    return <Toast onClose={hideToast}>{i18n('icu:TransportError')}</Toast>;
  }

  if (toastType === ToastType.UnableToLoadAttachment) {
    return (
      <Toast onClose={hideToast}>{i18n('icu:unableToLoadAttachment')}</Toast>
    );
  }

  if (toastType === ToastType.UnsupportedMultiAttachment) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:cannotSelectMultipleFileAttachments')}
      </Toast>
    );
  }

  if (toastType === ToastType.UnsupportedOS) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:UnsupportedOSErrorToast', { OS })}
      </Toast>
    );
  }

  if (toastType === ToastType.UsernameRecovered) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:EditUsernameModalBody__username-recovered__text', {
          username: toast.parameters.username,
        })}
      </Toast>
    );
  }

  if (toastType === ToastType.UserAddedToGroup) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:AddUserToAnotherGroupModal__toast--user-added-to-group', {
          contact: toast.parameters.contact,
          group: toast.parameters.group,
        })}
      </Toast>
    );
  }

  if (toastType === ToastType.VoiceNoteLimit) {
    return <Toast onClose={hideToast}>{i18n('icu:voiceNoteLimit')}</Toast>;
  }

  if (toastType === ToastType.VoiceNoteMustBeTheOnlyAttachment) {
    return (
      <Toast onClose={hideToast}>
        {i18n('icu:voiceNoteMustBeOnlyAttachment')}
      </Toast>
    );
  }

  if (toastType === ToastType.WhoCanFindMeReadOnly) {
    return (
      <Toast onClose={hideToast}>{i18n('icu:WhoCanFindMeReadOnlyToast')}</Toast>
    );
  }

  throw missingCaseError(toastType);
}

export function renderMegaphone({
  i18n,
  megaphone,
}: PropsType): JSX.Element | null {
  if (!megaphone) {
    return null;
  }

  if (megaphone.type === MegaphoneType.UsernameOnboarding) {
    return <UsernameMegaphone i18n={i18n} {...megaphone} />;
  }

  throw missingCaseError(megaphone.type);
}

export function ToastManager(props: PropsType): JSX.Element {
  const {
    centerToast,
    containerWidthBreakpoint,
    isCompositionAreaVisible,
    isInFullScreenCall,
  } = props;

  const toast = renderToast(props);

  return (
    <div
      className={classNames('ToastManager', {
        'ToastManager--narrow-sidebar':
          containerWidthBreakpoint === WidthBreakpoint.Narrow,
        'ToastManager--composition-area-visible': isCompositionAreaVisible,
      })}
    >
      {centerToast
        ? createPortal(
            <div
              className={classNames('ToastManager__root', {
                'ToastManager--full-screen-call': isInFullScreenCall,
              })}
            >
              {toast}
            </div>,
            document.body
          )
        : toast}
      {renderMegaphone(props)}
    </div>
  );
}
