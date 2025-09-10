// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import * as Errors from '../types/errors';
import { createLogger } from '../logging/log';
import { ProgressModal } from '../components/ProgressModal';
import { clearTimeoutIfNecessary } from './clearTimeoutIfNecessary';
import { sleep } from './sleep';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../components/fun/FunEmojiLocalizationProvider';
import { AxoProvider } from '../axo/AxoProvider';

const log = createLogger('longRunningTaskWrapper');

export async function longRunningTaskWrapper<T>({
  name,
  idForLogging,
  task,
  suppressErrorDialog,
}: {
  name: string;
  idForLogging: string;
  task: () => Promise<T>;
  suppressErrorDialog?: boolean;
}): Promise<T> {
  const idLog = `${name}/${idForLogging}`;
  const ONE_SECOND = 1000;
  const TWO_SECONDS = 2000;

  let progressRoot: Root | undefined;
  let spinnerStart;
  let progressTimeout: NodeJS.Timeout | undefined = setTimeout(() => {
    const progressNode = document.createElement('div');

    log.info(`${idLog}: Creating spinner`);
    progressRoot = createRoot(progressNode);
    progressRoot.render(
      <StrictMode>
        <AxoProvider dir={window.i18n.getLocaleDirection()}>
          <FunDefaultEnglishEmojiLocalizationProvider>
            <ProgressModal i18n={window.i18n} />
          </FunDefaultEnglishEmojiLocalizationProvider>
        </AxoProvider>
      </StrictMode>
    );
    spinnerStart = Date.now();
  }, TWO_SECONDS);

  // Note: any task we put here needs to have its own safety valve; this function will
  //   show a spinner until it's done
  try {
    log.info(`${idLog}: Starting task`);
    const result = await task();
    log.info(`${idLog}: Task completed successfully`);

    clearTimeoutIfNecessary(progressTimeout);
    progressTimeout = undefined;
    if (progressRoot) {
      const now = Date.now();
      if (spinnerStart && now - spinnerStart < ONE_SECOND) {
        log.info(
          `${idLog}: Spinner shown for less than second, showing for another second`
        );
        await sleep(ONE_SECOND);
      }
      progressRoot.unmount();
      progressRoot = undefined;
    }

    return result;
  } catch (error) {
    log.error(`${idLog}: Error!`, Errors.toLogFormat(error));

    clearTimeoutIfNecessary(progressTimeout);
    progressTimeout = undefined;
    if (progressRoot) {
      progressRoot.unmount();
      progressRoot = undefined;
    }

    if (!suppressErrorDialog) {
      log.info(`${idLog}: Showing error dialog`);
      window.reduxActions.globalModals.showErrorModal({});
    }

    throw error;
  }
}
