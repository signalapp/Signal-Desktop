import { shell } from 'electron';
import { useDispatch } from 'react-redux';
import { updateTermsOfServicePrivacyModal } from '../../state/onboarding/ducks/modals';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { SpacerSM } from '../basic/Text';
import { ModalConfirmButtonContainer } from '../buttons/ModalConfirmButtonContainer';

export type TermsOfServicePrivacyDialogProps = {
  show: boolean;
};

export function TermsOfServicePrivacyDialog(props: TermsOfServicePrivacyDialogProps) {
  const { show } = props;

  const dispatch = useDispatch();

  const onClose = () => {
    dispatch(updateTermsOfServicePrivacyModal(null));
  };

  if (!show) {
    return null;
  }

  return (
    <SessionWrapperModal
      title={window.i18n('urlOpen')}
      onClose={onClose}
      showExitIcon={true}
      showHeader={true}
      headerReverse={true}
    >
      <span>{window.i18n('urlOpenBrowser')}</span>
      <SpacerSM />
      <ModalConfirmButtonContainer container={true} justifyContent="center" alignItems="center">
        <SessionButton
          text={window.i18n('termsOfService')}
          buttonType={SessionButtonType.Ghost}
          onClick={() => {
            void shell.openExternal('https://getsession.org/terms-of-service');
          }}
          dataTestId="terms-of-service-button"
        />
        <SessionButton
          text={window.i18n('privacyPolicy')}
          buttonType={SessionButtonType.Ghost}
          onClick={() => {
            void shell.openExternal('https://getsession.org/privacy-policy');
          }}
          dataTestId="privacy-policy-button"
        />
      </ModalConfirmButtonContainer>
    </SessionWrapperModal>
  );
}
