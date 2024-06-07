import { useEffect } from 'react';
import styled from 'styled-components';
import { SessionTheme } from '../themes/SessionTheme';
import { switchThemeTo } from '../themes/switchTheme';
import { SessionToastContainer } from './SessionToastContainer';
import { Flex } from './basic/Flex';
import { SessionButtonType } from './basic/SessionButton';
import { CopyToClipboardButton } from './buttons/CopyToClipboardButton';

const StyledContent = styled(Flex)`
  background-color: var(--background-primary-color);
  color: var(--text-primary-color);
  text-align: center;

  font-family: var(--font-default);
  font-size: var(--font-size-sm);
  height: 100%;
  width: 100%;

  a {
    color: var(--text-primary-color);
  }

  img {
    margin: var(--margins-lg) 0 var(--margins-md);
  }

  .session-button {
    font-size: var(--font-size-sm);
    font-weight: 400;
    min-height: var(--font-size-sm);
    font-size: var(--font-size-sm);
    margin-bottom: var(--margins-xs);
  }
`;

export const AboutView = () => {
  // Add debugging metadata - environment if not production, app instance name
  const states = [];

  if (window.getEnvironment() !== 'production') {
    states.push(window.getEnvironment());
  }
  if (window.getAppInstance()) {
    states.push(window.getAppInstance());
  }

  const versionInfo = `v${window.getVersion()}`;
  const commitInfo = `Commit ${window.getCommitHash()}` || '';
  const osInfo = `${window.getOSRelease()}`;

  useEffect(() => {
    if (window.theme) {
      void switchThemeTo({
        theme: window.theme,
        usePrimaryColor: true,
      });
    }
  }, []);

  return (
    <SessionTheme>
      <SessionToastContainer />
      <StyledContent
        container={true}
        flexDirection={'column'}
        justifyContent={'center'}
        alignItems={'center'}
      >
        <img src="images/session/session_icon.png" width="250" height="250" alt="session icon" />

        <CopyToClipboardButton
          className="version"
          text={versionInfo}
          copyContent={versionInfo}
          buttonType={SessionButtonType.Simple}
        />
        <CopyToClipboardButton
          className="commitHash"
          text={commitInfo}
          copyContent={commitInfo}
          buttonType={SessionButtonType.Simple}
        />
        <CopyToClipboardButton
          className="os"
          text={osInfo}
          copyContent={osInfo}
          buttonType={SessionButtonType.Simple}
        />
        <CopyToClipboardButton
          className="environment"
          text={states.join(' - ')}
          copyContent={states.join(' - ')}
          buttonType={SessionButtonType.Simple}
        />
        <a href="https://getsession.org">https://getsession.org</a>
        <br />
        <a className="privacy" href="https://getsession.org/privacy-policy">
          {window.i18n('privacyPolicy')}
        </a>
        <a className="privacy" href="https://getsession.org/terms-of-service/">
          {window.i18n('termsOfService')}
        </a>
        <br />
      </StyledContent>
    </SessionTheme>
  );
};
