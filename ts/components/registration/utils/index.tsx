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
export const displayNameIsValid = (displayName?: string): string => {
  if (!displayName) {
    throw new Error(window.i18n('displayNameEmpty'));
  }

  const trimName = displayName.trim();
  if (!trimName) {
    throw new Error(window.i18n('displayNameEmpty'));
  }

  return trimName;
};
