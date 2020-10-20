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
