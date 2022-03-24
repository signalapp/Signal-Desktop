import React, { useEffect, useState } from 'react';

export const DebugLogView = () => {
  const [content, setContent] = useState(window.i18n('loading'));
  useEffect(() => {
    const operatingSystemInfo = `Operating System: ${(window as any).getOSRelease()}`;

    const commitHashInfo = (window as any).getCommitHash()
      ? `Commit Hash: ${(window as any).getCommitHash()}`
      : '';

    // eslint-disable-next-line more/no-then
    window.log.fetch().then((text: string) => {
      const debugLogWithSystemInfo = operatingSystemInfo + commitHashInfo + text;

      setContent(debugLogWithSystemInfo);
    });
  }, []);

  return (
    <div className="content">
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
      <textarea spellCheck="false" rows={5}>
        {content}
      </textarea>
      <div className="buttons">
        <button
          className="grey submit"
          onClick={e => {
            e.preventDefault();

            if (content.length <= 20) {
              // loading
              return;
            }
            (window as any).saveLog(content);
            (window as any).closeDebugLog();
          }}
        >
          {window.i18n('saveLogToDesktop')}
        </button>
      </div>
    </div>
  );
};
