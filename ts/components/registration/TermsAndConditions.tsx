import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { updateTermsOfServicePrivacyModal } from '../../state/ducks/modalDialog';
import { SessionHtmlRenderer } from '../basic/SessionHTMLRenderer';

const StyledTermsAndConditions = styled.div`
  padding-top: var(--margins-md);

  color: var(--text-secondary-color);
  text-align: center;
  font-size: 12px;

  b {
    font-weight: bold;
    color: var(--text-primary-color);
  }

  &:hover {
    cursor: pointer;
  }
`;

export const TermsAndConditions = () => {
  const dispatch = useDispatch();

  return (
    <StyledTermsAndConditions
      onClick={() => dispatch(updateTermsOfServicePrivacyModal({ show: true }))}
    >
      <SessionHtmlRenderer html={window.i18n('onboardingTosPrivacy')} />
    </StyledTermsAndConditions>
  );
};
