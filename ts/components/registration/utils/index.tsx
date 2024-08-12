import { Dispatch } from '@reduxjs/toolkit';
import { sanitizeSessionUsername } from '../../../session/utils/String';

export function sanitizeDisplayNameOrToast(
  displayName: string,
  // can be a useState or redux function
  onDisplayNameError: (error: string | undefined) => any,
  dispatch?: Dispatch
) {
  try {
    const sanitizedName = sanitizeSessionUsername(displayName);
    const errorString = !sanitizedName ? window.i18n('displayNameEmpty') : undefined;
    if (dispatch) {
      dispatch(onDisplayNameError(errorString));
    } else {
      onDisplayNameError(errorString); // this is is either calling dispatch in the caller or just `setDisplayNameError`
    }

    return sanitizedName;
  } catch (e) {
    if (dispatch) {
      dispatch(onDisplayNameError(window.i18n('displayNameErrorDescriptionShorter')));
    } else {
      onDisplayNameError(window.i18n('displayNameErrorDescriptionShorter'));
    }
    return displayName;
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
