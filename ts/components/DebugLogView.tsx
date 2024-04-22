import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { switchThemeTo } from '../themes/switchTheme';
import { SessionTheme } from '../themes/SessionTheme';
import { fetchNodeLog } from '../util/logging';
import { SessionButton, SessionButtonType } from './basic/SessionButton';
import { SessionIconButton } from './icon';

const StyledContent = styled.div`
  background-color: var(--modal-background-content-color);
  color: var(--modal-text-color);
  font-family: var(--font-default);

  display: flex;
  flex-direction: column;
  padding: 20px;
  height: 100%;

  .session-button {
    margin: 1rem auto 1rem 0;
    padding: 1rem;
    width: fit-content;
  }

  .session-icon-button {
    float: right;
  }

  h1 {
    color: var(--modal-text-color);
  }

  textarea {
    flex-grow: 1;
    width: 100%;
    box-sizing: border-box;
    padding: var(--margins-md);
    background-color: var(--input-background-color);
    color: var(--input-text-color);
    border: 2px solid var(--border-color);
    border-radius: 4px;
    resize: none;
    min-height: 100px;

    font-family: Monaco, Consolas, 'Courier New', Courier, monospace;
    font-size: 12px;
  }
`;

const DebugLogTextArea = (props: { content: string }) => {
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

const DebugLogViewAndSave = () => {
  const [content, setContent] = useState(window.i18n('loading'));

  useEffect(() => {
    const operatingSystemInfo = `Operating System: ${(window as any).getOSRelease()}`;

    const commitHashInfo = window.getCommitHash() ? `Commit Hash: ${window.getCommitHash()}` : '';

    // eslint-disable-next-line more/no-then
    fetchNodeLog()
      .then((text: any) => {
        const debugLogWithSystemInfo = `${operatingSystemInfo} ${commitHashInfo} ${text}`;
        setContent(debugLogWithSystemInfo);
      })
      // eslint-disable-next-line no-console
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
    if (window.theme) {
      void switchThemeTo({
        theme: window.theme,
      });
    }
  }, []);

  return (
    <SessionTheme>
      <StyledContent>
        <div>
          <SessionIconButton
            aria-label="close debug log"
            iconType="exit"
            iconSize="medium"
            onClick={() => {
              window.closeDebugLog();
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
