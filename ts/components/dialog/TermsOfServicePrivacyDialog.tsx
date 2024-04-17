import { shell } from 'electron';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { updateTermsOfServicePrivacyModal } from '../../state/onboarding/ducks/modals';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { Flex } from '../basic/Flex';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { SpacerSM } from '../basic/Text';

// NOTE we want to bypass the padding on the modal body so the buttons take up the full space
const ConfirmButtonContainer = styled(Flex)`
  margin: 0px calc(var(--margins-lg) * -1) calc(var(--margins-lg) * -1) calc(var(--margins-lg) * -1);
`;

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
      <div className="session-modal__centered">
        <span>{window.i18n('urlOpenBrowser')}</span>
        <SpacerSM />
        <ConfirmButtonContainer container={true} justifyContent="center" alignItems="center">
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
        </ConfirmButtonContainer>
      </div>
    </SessionWrapperModal>
  );
}
