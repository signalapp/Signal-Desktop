import { isEmpty } from 'lodash';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useMount from 'react-use/lib/useMount';
import { updateEnterPasswordModal } from '../state/ducks/modalDialog';
import { getPasswordHash } from '../util/storage';

/**
 * Password protection for a component if a password has been set
 * @param title - Title of the password modal
 * @param onSuccess - Callback when password is correct
 * @param onClose - Callback when modal is cancelled or closed. Definitely use this if your component returns null until a password is entered
 * @returns An object with two properties - hasPassword which is true if a password has been set, passwordValid which is true if the password entered is correct
 */
export function usePasswordModal({
  title,
  onSuccess,
  onClose,
}: {
  title?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}) {
  const [hasPassword, setHasPassword] = useState(false);
  const [passwordHash, setPasswordHash] = useState('');
  const [passwordValid, setPasswordValid] = useState(false);

  const dispatch = useDispatch();

  const validateAccess = () => {
    if (!isEmpty(passwordHash)) {
      return;
    }

    const hash = getPasswordHash();
    setHasPassword(!!hash);

    if (hash) {
      setPasswordHash(hash);
      dispatch(
        updateEnterPasswordModal({
          passwordHash,
          passwordValid,
          setPasswordValid,
          onClickOk: () => {
            if (onSuccess) {
              onSuccess();
            }
            setPasswordHash('');
            dispatch(updateEnterPasswordModal(null));
          },
          onClickClose: () => {
            if (onClose) {
              onClose();
            }
            setPasswordHash('');
            dispatch(updateEnterPasswordModal(null));
          },
          title,
        })
      );
    }
  };

  useMount(() => {
    validateAccess();
  });

  return { hasPassword, passwordValid };
}
