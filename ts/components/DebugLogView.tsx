import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { fetch } from '../util/logging';

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  padding: 10px;
  height: 100%;
`;

const DebugLogTextArea = (props: { content: string }) => {
  console.warn('DebugLogTextArea ', props.content);
  // tslint:disable-next-line: react-a11y-input-elements
  return <textarea spellCheck="false" rows={10} value={props.content} style={{ height: '100%' }} />;
};

const DebugLogButtons = (props: { content: string }) => {
  return (
    <div className="buttons">
      <button
        className="grey submit"
        onClick={e => {
          e.preventDefault();

          if (props.content.length <= 20) {
            // loading
            return;
          }
          (window as any).saveLog(props.content);
          (window as any).closeDebugLog();
        }}
      >
        {window.i18n('saveLogToDesktop')}
      </button>
    </div>
  );
};

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
      .catch(console.warn);
  }, []);

  return (
    <>
      <DebugLogTextArea content={content} />
      <DebugLogButtons content={content} />
    </>
  );
};

export const DebugLogView = () => {
  return (
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
  );
};
