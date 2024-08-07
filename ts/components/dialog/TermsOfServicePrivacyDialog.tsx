import { shell } from 'electron';
import { useDispatch } from 'react-redux';
import { updateTermsOfServicePrivacyModal } from '../../state/onboarding/ducks/modals';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { Flex } from '../basic/Flex';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { SpacerSM } from '../basic/Text';

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
      additionalClassName={'no-body-padding'}
    >
      <span>{window.i18n('urlOpenBrowser')}</span>
      <SpacerSM />
      <Flex container={true} width={'100%'} justifyContent="center" alignItems="center">
        <SessionButton
          ariaLabel={'Terms of service button'}
          text={window.i18n('termsOfService')}
          buttonType={SessionButtonType.Ghost}
          onClick={() => {
            void shell.openExternal('https://getsession.org/terms-of-service');
          }}
          dataTestId="terms-of-service-button"
        />
        <SessionButton
          ariaLabel={'Privacy policy button'}
          text={window.i18n('privacyPolicy')}
          buttonType={SessionButtonType.Ghost}
          onClick={() => {
            void shell.openExternal('https://getsession.org/privacy-policy');
          }}
          dataTestId="privacy-policy-button"
        />
      </Flex>
    </SessionWrapperModal>
  );
}
