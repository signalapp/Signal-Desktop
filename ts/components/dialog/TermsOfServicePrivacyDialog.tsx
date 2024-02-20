import { noop } from 'lodash';
import { useDispatch } from 'react-redux';
import { updateTermsOfServicePrivacyModal } from '../../state/ducks/modalDialog';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonShape, SessionButtonType } from '../basic/SessionButton';

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

  // TODO[epic=ses-900] need to add redux context to initial screens... or at the very least,  a separate onboarding redux state
  return (
    <SessionWrapperModal
      title={window.i18n('urlOpen')}
      onClose={onClose}
      showExitIcon={true}
      showHeader={true}
    >
      <div className="session-modal__centered">
        <span className="session-confirm-sub-message">{window.i18n('urlOpenBrowser')}</span>

        <div className="session-modal__button-group">
          <SessionButton
            text={window.i18n('termsOfService')}
            buttonType={SessionButtonType.Simple}
            buttonShape={SessionButtonShape.Square}
            onClick={noop}
            dataTestId="session-tos-button"
          />
          <SessionButton
            text={window.i18n('privacyPolicy')}
            buttonType={SessionButtonType.Simple}
            buttonShape={SessionButtonShape.Square}
            onClick={noop}
            dataTestId="session-privacy-policy-button"
          />
        </div>
      </div>
    </SessionWrapperModal>
  );
}
