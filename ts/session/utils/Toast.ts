export function push(options: {
  title: string;
  id?: string;
  description?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  icon?: string;
  shouldFade?: boolean;
}) {
  window.pushToast(options);
}

export function pushLoadAttachmentFailure() {
  window.pushToast({
    title: window.i18n('unableToLoadAttachment'),
    type: 'error',
    id: 'unableToLoadAttachment',
  });
}

export function pushDangerousFileError() {
  window.pushToast({
    title: window.i18n('dangerousFileType'),
    type: 'error',
    id: 'dangerousFileType',
  });
}

export function pushFileSizeError(limit: number, units: string) {
  window.pushToast({
    title: window.i18n('fileSizeWarning'),
    description: `Max size: ${limit} ${units}`,
    type: 'error',
    id: 'fileSizeWarning',
  });
}

export function pushMultipleNonImageError() {
  window.pushToast({
    title: window.i18n('cannotMixImageAndNonImageAttachments'),
    type: 'error',
    id: 'cannotMixImageAndNonImageAttachments',
  });
}

export function pushCannotMixError() {
  window.pushToast({
    title: window.i18n('oneNonImageAtATimeToast'),
    type: 'error',
    id: 'oneNonImageAtATimeToast',
  });
}

export function pushMaximumAttachmentsError() {
  window.pushToast({
    title: window.i18n('maximumAttachments'),
    type: 'error',
    id: 'maximumAttachments',
  });
}

export function pushMessageBodyTooLong() {
  window.pushToast({
    title: window.i18n('messageBodyTooLong'),
    type: 'error',
    id: 'messageBodyTooLong',
  });
}

export function pushMessageBodyMissing() {
  window.pushToast({
    title: window.i18n('messageBodyMissing'),
    type: 'error',
    id: 'messageBodyMissing',
  });
}

export function pushCopiedToClipBoard() {
  window.pushToast({
    title: window.i18n('copiedToClipboard'),
    type: 'success',
    id: 'copiedToClipboard',
  });
}

export function pushForceUnlinked() {
  window.pushToast({
    title: window.i18n('successUnlinked'),
    type: 'info',
    id: 'successUnlinked',
  });
}

export function pushSpellCheckDirty() {
  window.pushToast({
    title: window.i18n('spellCheckDirty'),
    type: 'info',
    id: 'spellCheckDirty',
  });
}

export function pushAlreadyMemberOpenGroup() {
  window.pushToast({
    title: window.i18n('publicChatExists'),
    type: 'info',
    id: 'alreadyMemberPublicChat',
  });
}

export function pushUserBanSuccess() {
  window.pushToast({
    title: window.i18n('userBanned'),
    type: 'success',
    id: 'userBanned',
  });
}

export function pushUserBanFailure() {
  window.pushToast({
    title: window.i18n('userBanFailed'),
    type: 'error',
    id: 'userBanFailed',
  });
}

export function pushMessageDeleteForbidden() {
  window.pushToast({
    title: window.i18n('messageDeletionForbidden'),
    type: 'error',
    id: 'messageDeletionForbidden',
  });
}

export function pushAudioPermissionNeeded() {
  window.pushToast({
    id: 'audioPermissionNeeded',
    title: window.i18n('audioPermissionNeededTitle'),
    description: window.i18n('audioPermissionNeeded'),
    type: 'info',
  });
}

export function pushOriginalNotFound() {
  window.pushToast({
    id: 'originalMessageNotFound',
    title: window.i18n('originalMessageNotFound'),
    type: 'error',
  });
}

export function pushOriginalNoLongerAvailable() {
  window.pushToast({
    id: 'originalMessageNotAvailable',
    title: window.i18n('originalMessageNotAvailable'),
    type: 'error',
  });
}

export function pushFoundButNotLoaded() {
  window.pushToast({
    id: 'messageFoundButNotLoaded',
    title: window.i18n('messageFoundButNotLoaded'),
    type: 'error',
  });
}
