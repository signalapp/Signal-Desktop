import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import { ToastUtils } from '../../session/utils';
import { matchesHash } from '../../util/passwordUtils';

import { updateEnterPasswordModal } from '../../state/ducks/modalDialog';
import { SpacerSM } from '../basic/Text';

import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';

const StyledModalContainer = styled.div`
  margin: var(--margins-md) var(--margins-sm);
`;

export type EnterPasswordModalProps = {
  passwordHash: string;
  passwordValid: boolean;
  setPasswordValid: (value: boolean) => void;
  onClickOk?: () => any;
  onClickClose?: () => any;
  title?: string;
};

export const EnterPasswordModal = (props: EnterPasswordModalProps) => {
  const { passwordHash, setPasswordValid, onClickOk, onClickClose, title } = props;
  const dispatch = useDispatch();

  const onClose = () => {
    if (onClickClose) {
      onClickClose();
    }
    dispatch(updateEnterPasswordModal(null));
  };

  const confirmPassword = () => {
    const passwordValue = (document.getElementById('seed-input-password') as any)?.value;
    const isPasswordValid = matchesHash(passwordValue as string, passwordHash);

    if (!passwordValue) {
      ToastUtils.pushToastError('enterPasswordErrorToast', window.i18n('noGivenPassword'));

      return;
    }

    if (passwordHash && !isPasswordValid) {
      ToastUtils.pushToastError('enterPasswordErrorToast', window.i18n('invalidPassword'));
      return;
    }

    setPasswordValid(true);

    window.removeEventListener('keyup', onEnter);

    if (onClickOk) {
      void onClickOk();
    }
  };

  const onEnter = (event: any) => {
    if (event.key === 'Enter') {
      confirmPassword();
    }
  };

  return (
    <SessionWrapperModal
      title={title || window.i18n('enterPassword')}
      onClose={onClose}
      showExitIcon={true}
    >
      <StyledModalContainer>
        <SpacerSM />

        <div className="session-modal__input-group">
          <input
            type="password"
            id="seed-input-password"
            data-testid="password-input"
            placeholder={window.i18n('enterPassword')}
            onKeyUp={onEnter}
          />
        </div>

        <SpacerSM />

        <div
          className="session-modal__button-group"
          style={{ justifyContent: 'center', width: '100%' }}
        >
          <SessionButton
            text={window.i18n('done')}
            buttonType={SessionButtonType.Simple}
            onClick={confirmPassword}
            dataTestId="session-confirm-ok-button"
          />
          <SessionButton
            text={window.i18n('cancel')}
            buttonType={SessionButtonType.Simple}
            buttonColor={SessionButtonColor.Danger}
            onClick={onClose}
            dataTestId="session-confirm-cancel-button"
          />
        </div>
      </StyledModalContainer>
    </SessionWrapperModal>
  );
};
