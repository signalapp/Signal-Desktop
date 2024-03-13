import { ToastUtils } from '../../../session/utils';
import { sanitizeSessionUsername } from '../../../session/utils/String';

export function sanitizeDisplayNameOrToast(
  displayName: string,
  setDisplayName: (sanitized: string) => void,
  setDisplayNameError: (error: string | undefined) => void
) {
  try {
    const sanitizedName = sanitizeSessionUsername(displayName);
    const trimName = sanitizedName.trim();
    setDisplayName(sanitizedName);
    setDisplayNameError(!trimName ? window.i18n('displayNameEmpty') : undefined);
  } catch (e) {
    setDisplayName(displayName);
    setDisplayNameError(window.i18n('displayNameErrorDescriptionShorter'));
  }
}

/**
 * Returns undefined if an error happened, or the trim userName.
 *
 * Be sure to use the trimmed userName for creating the account.
 */
export const displayNameIsValid = (displayName: string): undefined | string => {
  const trimName = displayName.trim();

  if (!trimName) {
    window?.log?.warn('invalid trimmed name for registration');
    ToastUtils.pushToastError('invalidDisplayName', window.i18n('displayNameEmpty'));
    return undefined;
  }
  return trimName;
};
