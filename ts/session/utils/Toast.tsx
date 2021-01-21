import React from 'react';
import { toast } from 'react-toastify';
import { SessionIconType } from '../../components/session/icon';
import {
  SessionToast,
  SessionToastType,
} from '../../components/session/SessionToast';

// if you push a toast manually with toast...() be sure to set the type attribute of the SessionToast component
export function pushToastError(
  id: string,
  title: string,
  description?: string
) {
  toast.error(
    <SessionToast
      title={title}
      description={description}
      type={SessionToastType.Error}
    />
  );
}

export function pushToastWarning(
  id: string,
  title: string,
  description?: string
) {
  toast.warning(
    <SessionToast
      title={title}
      description={description}
      type={SessionToastType.Warning}
    />
  );
}

export function pushToastInfo(id: string, title: string, description?: string) {
  toast.info(
    <SessionToast
      title={title}
      description={description}
      type={SessionToastType.Info}
    />
  );
}

export function pushToastSuccess(
  id: string,
  title: string,
  description?: string,
  icon?: SessionIconType
) {
  toast.success(
    <SessionToast
      title={title}
      description={description}
      type={SessionToastType.Success}
      icon={icon}
    />
  );
}

export function pushLoadAttachmentFailure(message?: string) {
  if (message) {
    pushToastError(
      'unableToLoadAttachment',
      `${window.i18n('unableToLoadAttachment')} ${message}`
    );
  } else {
    pushToastError(
      'unableToLoadAttachment',
      window.i18n('unableToLoadAttachment')
    );
  }
}

export function pushDangerousFileError() {
  pushToastError('dangerousFileType', window.i18n('dangerousFileType'));
}

export function pushFileSizeError(limit: number, units: string) {
  pushToastError(
    'fileSizeWarning',
    window.i18n('fileSizeWarning'),
    `Max size: ${limit} ${units}`
  );
}

export function pushFileSizeErrorAsByte(bytesCount: number) {
  const units = ['kB', 'MB', 'GB'];
  let u = -1;
  let limit = bytesCount;
  do {
    limit /= 1000;
    u += 1;
  } while (limit >= 1000 && u < units.length - 1);
  pushFileSizeError(limit, units[u]);
}

export function pushMultipleNonImageError() {
  pushToastError(
    'cannotMixImageAndNonImageAttachments',
    window.i18n('cannotMixImageAndNonImageAttachments')
  );
}

export function pushCannotMixError() {
  pushToastError(
    'oneNonImageAtATimeToast',
    window.i18n('oneNonImageAtATimeToast')
  );
}

export function pushMaximumAttachmentsError() {
  pushToastError('maximumAttachments', window.i18n('maximumAttachments'));
}

export function pushMessageBodyTooLong() {
  pushToastError('messageBodyTooLong', window.i18n('messageBodyTooLong'));
}

export function pushMessageBodyMissing() {
  pushToastError('messageBodyMissing', window.i18n('messageBodyMissing'));
}

export function pushCopiedToClipBoard() {
  pushToastInfo('copiedToClipboard', window.i18n('copiedToClipboard'));
}

export function pushForceUnlinked() {
  pushToastInfo('successUnlinked', window.i18n('successUnlinked'));
}

export function pushSpellCheckDirty() {
  pushToastInfo('spellCheckDirty', window.i18n('spellCheckDirty'));
}

export function pushAlreadyMemberOpenGroup() {
  pushToastInfo('publicChatExists', window.i18n('publicChatExists'));
}

export function pushUserBanSuccess() {
  pushToastSuccess('userBanned', window.i18n('userBanned'));
}

export function pushUserBanFailure() {
  pushToastError('userBanFailed', window.i18n('userBanFailed'));
}

export function pushMessageDeleteForbidden() {
  pushToastError(
    'messageDeletionForbidden',
    window.i18n('messageDeletionForbidden')
  );
}

export function pushAudioPermissionNeeded() {
  pushToastInfo(
    'audioPermissionNeeded',
    window.i18n('audioPermissionNeededTitle'),
    window.i18n('audioPermissionNeeded')
  );
}

export function pushOriginalNotFound() {
  pushToastError(
    'originalMessageNotFound',
    window.i18n('originalMessageNotFound')
  );
}

export function pushOriginalNoLongerAvailable() {
  pushToastError(
    'originalMessageNotAvailable',
    window.i18n('originalMessageNotAvailable')
  );
}

export function pushFoundButNotLoaded() {
  pushToastError(
    'messageFoundButNotLoaded',
    window.i18n('messageFoundButNotLoaded')
  );
}

export function pushTooManyMembers() {
  pushToastError('tooManyMembers', window.i18n('closedGroupMaxSize'));
}

export function pushUnblockToSend() {
  pushToastInfo('unblockToSend', window.i18n('unblockToSend'));
}

export function pushUnblockToSendGroup() {
  pushToastInfo('unblockGroupToSend', window.i18n('unblockGroupToSend'));
}

export function pushClockOutOfSync() {
  pushToastError('clockOutOfSync', window.i18n('clockOutOfSync'));
}

export function pushYouLeftTheGroup() {
  pushToastError('youLeftTheGroup', window.i18n('youLeftTheGroup'));
}

export function pushDeleted() {
  pushToastSuccess(
    'deleted',
    window.i18n('deleted'),
    undefined,
    SessionIconType.Check
  );
}

export function pushCannotRemoveCreatorFromGroup() {
  pushToastWarning(
    'cannotRemoveCreatorFromGroup',
    window.i18n('cannotRemoveCreatorFromGroup'),
    window.i18n('cannotRemoveCreatorFromGroupDesc')
  );
}

export function pushUserNeedsToHaveJoined() {
  pushToastWarning(
    'userNeedsToHaveJoined',
    window.i18n('userNeedsToHaveJoined'),
    window.i18n('userNeedsToHaveJoinedDesc')
  );
}

export function pushUserAddedToModerators() {
  pushToastSuccess(
    'userAddedToModerators',
    window.i18n('userAddedToModerators')
  );
}

export function pushUserRemovedToModerators() {
  pushToastSuccess(
    'userRemovedFromModerators',
    window.i18n('userRemovedFromModerators')
  );
}

export function pushInvalidPubKey() {
  pushToastSuccess('invalidPubKey', window.i18n('invalidPubkeyFormat'));
}
