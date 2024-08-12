import { useSelector } from 'react-redux';
import {
  getQuitModalState,
  getTermsOfServicePrivacyModalState,
} from '../../state/onboarding/selectors/modals';
import { QuitModal } from '../dialog/QuitModal';
import { TermsOfServicePrivacyDialog } from '../dialog/TermsOfServicePrivacyDialog';

export const ModalContainer = () => {
  const quitModalState = useSelector(getQuitModalState);
  const termsOfServicePrivacyModalState = useSelector(getTermsOfServicePrivacyModalState);

  return (
    <>
      {quitModalState && <QuitModal {...quitModalState} />}
      {termsOfServicePrivacyModalState && (
        <TermsOfServicePrivacyDialog {...termsOfServicePrivacyModalState} />
      )}
    </>
  );
};
