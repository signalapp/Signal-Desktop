import { useSelector } from 'react-redux';
import { getTermsOfServicePrivacyModalState } from '../../state/onboarding/selectors/modals';
import { TermsOfServicePrivacyDialog } from '../dialog/TermsOfServicePrivacyDialog';

export const ModalContainer = () => {
  const termsOfServicePrivacyModalState = useSelector(getTermsOfServicePrivacyModalState);

  return (
    <>
      {termsOfServicePrivacyModalState && (
        <TermsOfServicePrivacyDialog {...termsOfServicePrivacyModalState} />
      )}
    </>
  );
};
