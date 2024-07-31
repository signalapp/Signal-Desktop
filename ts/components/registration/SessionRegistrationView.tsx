import { Provider } from 'react-redux';
import styled from 'styled-components';

import useMount from 'react-use/lib/useMount';
import { onboardingStore } from '../../state/onboarding/store';
import { SessionTheme } from '../../themes/SessionTheme';
import { setSignInByLinking } from '../../util/storage';
import { SessionToastContainer } from '../SessionToastContainer';
import { Flex } from '../basic/Flex';
import { ModalContainer } from './ModalContainer';
import { RegistrationStages } from './RegistrationStages';
import { Hero } from './components';

const StyledFullscreenContainer = styled(Flex)`
  position: relative;
  width: 100%;
  height: 100%;
  background-color: var(--background-primary-color);
  color: var(--text-primary-color);
`;

const StyledSessionContent = styled(Flex)`
  z-index: 1;
  &-accent {
    &-text {
      font-family: var(--font-accent), var(--font-default);
      text-align: center;
      .title {
        font-size: 90px;
        font-weight: 700;
        line-height: 100px;
      }
    }
  }

  &-registration {
    padding-inline-end: 128px;
  }

  &-header {
    display: flex;
    flex-direction: row;
    width: 100%;
    justify-content: space-between;
    padding: 17px 20px;
  }

  &-body {
    display: flex;
    flex-direction: row;
    flex: 1;
    align-items: center;
    width: 100%;
    padding-bottom: 20px;
  }
`;

export const SessionRegistrationView = () => {
  useMount(() => {
    void setSignInByLinking(false);
  });

  return (
    <Provider store={onboardingStore}>
      <SessionTheme>
        <StyledFullscreenContainer container={true} alignItems="center">
          <Hero />
          <StyledSessionContent
            flexDirection="column"
            alignItems="center"
            container={true}
            height="100%"
            flexGrow={1}
          >
            <Flex container={true} margin="auto" alignItems="center" flexDirection="column">
              <SessionToastContainer />
              <ModalContainer />
              <RegistrationStages />
            </Flex>
          </StyledSessionContent>
        </StyledFullscreenContainer>
      </SessionTheme>
    </Provider>
  );
};
