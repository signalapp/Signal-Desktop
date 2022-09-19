import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  SessionTheme,
  switchHtmlToDarkTheme,
  switchHtmlToLightTheme,
} from '../themes/SessionTheme';
import { fetch } from '../util/logging';
import { SessionButton, SessionButtonType } from './basic/SessionButton';

const StyledContent = styled.div`
  background-color: var(--color-modal-background);
  color: var(--color-text);
  font-family: var(--font-default);

  display: flex;
  flex-direction: column;
  padding: 20px;
  height: 100%;

  .session-button {
    margin: 1em auto 1em 0;
    padding: 1em;
    width: fit-content;
  }

  h1 {
    color: var(--color-text);
  }

  textarea {
    flex-grow: 1;
    width: 100%;
    box-sizing: border-box;
    padding: var(--margins-sm);
    border: 2px solid var(--color-session-border);
    resize: none;
    min-height: 100px;

    font-family: Monaco, Consolas, 'Courier New', Courier, monospace;
    font-size: 12px;
  }
`;

const DebugLogTextArea = (props: { content: string }) => {
  // tslint:disable-next-line: react-a11y-input-elements
  return <textarea spellCheck="false" rows={10} value={props.content} style={{ height: '100%' }} />;
};

const DebugLogButtons = (props: { content: string }) => {
  return (
    <div className="buttons">
      <SessionButton
        text={window.i18n('saveLogToDesktop')}
        buttonType={SessionButtonType.Simple}
        onClick={() => {
          if (props.content.length <= 20) {
            // loading
            return;
          }
          (window as any).saveLog(props.content);
        }}
      />
    </div>
  );
};
// tslint:disable: no-console

const DebugLogViewAndSave = () => {
  const [content, setContent] = useState(window.i18n('loading'));

  useEffect(() => {
    const operatingSystemInfo = `Operating System: ${(window as any).getOSRelease()}`;

    const commitHashInfo = (window as any).getCommitHash()
      ? `Commit Hash: ${(window as any).getCommitHash()}`
      : '';

    // eslint-disable-next-line more/no-then
    fetch()
      .then((text: any) => {
        const debugLogWithSystemInfo = `${operatingSystemInfo} ${commitHashInfo} ${text}`;
        setContent(debugLogWithSystemInfo);
      })
      .catch(console.error);
  }, []);

  return (
    <>
      <DebugLogTextArea content={content} />
      <DebugLogButtons content={content} />
    </>
  );
};

export const DebugLogView = () => {
  useEffect(() => {
    if ((window as any).theme === 'dark') {
      switchHtmlToDarkTheme();
    } else {
      switchHtmlToLightTheme();
    }
  }, []);

  return (
    <SessionTheme>
      <StyledContent>
        <div>
          <button
            className="x close"
            aria-label="close debug log"
            onClick={() => {
              (window as any).closeDebugLog();
            }}
          />
          <h1> {window.i18n('debugLog')} </h1>
          <p> {window.i18n('debugLogExplanation')}</p>
        </div>
        <DebugLogViewAndSave />
      </StyledContent>
    </SessionTheme>
  );
};
