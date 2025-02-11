// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MouseEvent } from 'react';
import React, { useEffect, useState } from 'react';
import copyText from 'copy-text-to-clipboard';
import type { LocalizerType } from '../types/Util';
import * as Errors from '../types/errors';
import type { AnyToast } from '../types/Toast';
import { ToastType } from '../types/Toast';
import * as log from '../logging/log';
import { Button, ButtonVariant } from './Button';
import { Spinner } from './Spinner';
import { ToastManager } from './ToastManager';
import { createSupportUrl } from '../util/createSupportUrl';
import { shouldNeverBeCalled } from '../util/shouldNeverBeCalled';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';
import { useEscapeHandling } from '../hooks/useEscapeHandling';

enum LoadState {
  NotStarted,
  Started,
  Loaded,
  Submitting,
}

export type PropsType = {
  closeWindow: () => unknown;
  downloadLog: (text: string) => unknown;
  i18n: LocalizerType;
  fetchLogs: () => Promise<string>;
  uploadLogs: (logs: string) => Promise<string>;
};

export function DebugLogWindow({
  closeWindow,
  downloadLog,
  i18n,
  fetchLogs,
  uploadLogs,
}: PropsType): JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>(LoadState.NotStarted);
  const [logText, setLogText] = useState<string | undefined>();
  const [publicLogURL, setPublicLogURL] = useState<string | undefined>();
  const [textAreaValue, setTextAreaValue] = useState<string>(
    i18n('icu:loading')
  );
  const [toast, setToast] = useState<AnyToast | undefined>();

  useEscapeHandling(closeWindow);

  useEffect(() => {
    setLoadState(LoadState.Started);

    let shouldCancel = false;

    async function doFetchLogs() {
      const fetchedLogText = await fetchLogs();

      if (shouldCancel) {
        return;
      }

      setToast({ toastType: ToastType.LoadingFullLogs });
      setLogText(fetchedLogText);
      setLoadState(LoadState.Loaded);

      // This number is somewhat arbitrary; we want to show enough that it's
      // clear that we need to scroll, but not so many that things get slow.
      const linesToShow = Math.ceil(Math.min(window.innerHeight, 2000) / 5);
      const value = fetchedLogText.split(/\n/g, linesToShow).join('\n');

      setTextAreaValue(`${value}\n\n\n${i18n('icu:debugLogLogIsIncomplete')}`);
      setToast(undefined);
    }

    void doFetchLogs();

    return () => {
      shouldCancel = true;
    };
  }, [fetchLogs, i18n]);

  const handleSubmit = async (ev: MouseEvent) => {
    ev.preventDefault();

    const text = logText;

    if (!text || text.length === 0) {
      return;
    }

    setLoadState(LoadState.Submitting);

    try {
      const publishedLogURL = await uploadLogs(text);
      setPublicLogURL(publishedLogURL);
    } catch (error) {
      log.error('DebugLogWindow error:', Errors.toLogFormat(error));
      setLoadState(LoadState.Loaded);
      setToast({ toastType: ToastType.DebugLogError });
    }
  };

  function closeToast() {
    setToast(undefined);
  }

  if (publicLogURL) {
    const copyLog = (ev: MouseEvent) => {
      ev.preventDefault();
      copyText(publicLogURL);
      setToast({ toastType: ToastType.LinkCopied });
    };

    const supportURL = createSupportUrl({
      locale: window.SignalContext.getI18nLocale(),
      query: {
        debugLog: publicLogURL,
      },
    });

    return (
      <div className="DebugLogWindow">
        <div>
          <div className="DebugLogWindow__title">
            {i18n('icu:debugLogSuccess')}
          </div>
          <p className="DebugLogWindow__subtitle">
            {i18n('icu:debugLogSuccessNextSteps')}
          </p>
        </div>
        <div className="DebugLogWindow__container">
          <input
            className="DebugLogWindow__link"
            readOnly
            type="text"
            dir="auto"
            value={publicLogURL}
          />
        </div>
        <div className="DebugLogWindow__footer">
          <Button
            onClick={() => openLinkInWebBrowser(supportURL)}
            variant={ButtonVariant.Secondary}
          >
            {i18n('icu:reportIssue')}
          </Button>
          <Button onClick={copyLog}>{i18n('icu:debugLogCopy')}</Button>
        </div>
        <ToastManager
          OS="unused"
          hideToast={closeToast}
          i18n={i18n}
          onShowDebugLog={shouldNeverBeCalled}
          onUndoArchive={shouldNeverBeCalled}
          openFileInFolder={shouldNeverBeCalled}
          showAttachmentNotAvailableModal={shouldNeverBeCalled}
          toast={toast}
          containerWidthBreakpoint={null}
          isInFullScreenCall={false}
        />
      </div>
    );
  }

  const canSubmit = Boolean(logText) && loadState !== LoadState.Submitting;
  const canSave = Boolean(logText);
  const isLoading =
    loadState === LoadState.Started || loadState === LoadState.Submitting;

  return (
    <div className="DebugLogWindow">
      <div>
        <div className="DebugLogWindow__title">
          {i18n('icu:submitDebugLog')}
        </div>
        <p className="DebugLogWindow__subtitle">
          {i18n('icu:debugLogExplanation')}
        </p>
      </div>
      {isLoading ? (
        <div className="DebugLogWindow__container">
          <Spinner svgSize="normal" />
        </div>
      ) : (
        <div className="DebugLogWindow__scroll_area">
          <pre className="DebugLogWindow__scroll_area__text">
            {textAreaValue}
          </pre>
        </div>
      )}
      <div className="DebugLogWindow__footer">
        <Button
          disabled={!canSave}
          onClick={() => {
            if (logText) {
              downloadLog(logText);
            }
          }}
          variant={ButtonVariant.Secondary}
        >
          {i18n('icu:debugLogSave')}
        </Button>
        <Button disabled={!canSubmit} onClick={handleSubmit}>
          {i18n('icu:submit')}
        </Button>
      </div>
      <ToastManager
        OS="unused"
        hideToast={closeToast}
        i18n={i18n}
        onShowDebugLog={shouldNeverBeCalled}
        onUndoArchive={shouldNeverBeCalled}
        openFileInFolder={shouldNeverBeCalled}
        showAttachmentNotAvailableModal={shouldNeverBeCalled}
        toast={toast}
        containerWidthBreakpoint={null}
        isInFullScreenCall={false}
      />
    </div>
  );
}
