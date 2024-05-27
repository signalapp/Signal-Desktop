import { Dispatch } from '@reduxjs/toolkit';
import { RefObject } from 'react';
import { editProfileModal } from '../../../state/ducks/modalDialog';
import { ProfileDialogModes } from './EditProfileDialog';

export const handleKeyQRMode = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  loading: boolean
) => {
  if (loading) {
    return;
  }
  switch (mode) {
    case 'default':
      setMode('qr');
      break;
    case 'qr':
      setMode('default');
      break;
    case 'edit':
    default:
  }
};

export const handleKeyEditMode = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  onClick: () => Promise<void>,
  loading: boolean
) => {
  if (loading) {
    return;
  }
  switch (mode) {
    case 'default':
      setMode('edit');
      break;
    case 'edit':
      void onClick();
      break;
    case 'qr':
    default:
  }
};

export const handleKeyCancel =
  (
    mode: ProfileDialogModes,
    setMode: (mode: ProfileDialogModes) => void,
    inputRef: RefObject<HTMLInputElement>,
    updatedProfileName: string,
    setProfileName: (name: string) => void,
    setProfileNameError: (error: string | undefined) => void,
    loading: boolean
  ) =>
  () => {
    if (loading) {
      return;
    }
    switch (mode) {
      case 'edit':
      case 'qr':
        if (inputRef.current !== null && document.activeElement === inputRef.current) {
          return;
        }
        setMode('default');
        if (mode === 'edit') {
          setProfileNameError(undefined);
          setProfileName(updatedProfileName);
        }
        break;
      case 'default':
      default:
    }
  };

export const handleKeyEscape = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  updatedProfileName: string,
  setProfileName: (name: string) => void,
  setProfileNameError: (error: string | undefined) => void,
  loading: boolean,
  dispatch: Dispatch
) => {
  if (loading) {
    return;
  }
  if (mode === 'edit') {
    setMode('default');
    setProfileNameError(undefined);
    setProfileName(updatedProfileName);
  } else {
    dispatch(editProfileModal(null));
  }
};
