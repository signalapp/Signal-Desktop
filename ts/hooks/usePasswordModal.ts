import { isEmpty } from 'lodash';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useMount } from 'react-use';
import { Data } from '../data/data';
import { updateEnterPasswordModal } from '../state/ducks/modalDialog';

export function usePasswordModal({
  onSuccess,
  onClose,
  title,
}: {
  onSuccess: () => void;
  onClose: () => void;
  title?: string;
}) {
  const [passwordHash, setPasswordHash] = useState('');
  const [passwordValid, setPasswordValid] = useState(false);

  const dispatch = useDispatch();

  const validateAccess = async () => {
    if (!isEmpty(passwordHash)) {
      return;
    }

    const hash = await Data.getPasswordHash();
    if (hash && !isEmpty(hash)) {
      setPasswordHash(hash);
      dispatch(
        updateEnterPasswordModal({
          passwordHash,
          passwordValid,
          setPasswordValid,
          onClickOk: () => {
            onSuccess();
            setPasswordHash('');
            dispatch(updateEnterPasswordModal(null));
          },
          onClickClose: () => {
            onClose();
            setPasswordHash('');
            dispatch(updateEnterPasswordModal(null));
          },
          title,
        })
      );
    }
  };

  useMount(() => {
    void validateAccess();
  });
}
