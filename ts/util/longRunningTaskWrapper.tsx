// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';

import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { ProgressModal } from '../components/ProgressModal';
import { clearTimeoutIfNecessary } from './clearTimeoutIfNecessary';
import { sleep } from './sleep';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../components/fun/FunEmojiLocalizationProvider';

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

  let progressNode: HTMLDivElement | undefined;
  let spinnerStart;
  let progressTimeout: NodeJS.Timeout | undefined = setTimeout(() => {
    progressNode = document.createElement('div');

    log.info(`longRunningTaskWrapper/${idLog}: Creating spinner`);
    render(
      <FunDefaultEnglishEmojiLocalizationProvider>
        <ProgressModal i18n={window.i18n} />
      </FunDefaultEnglishEmojiLocalizationProvider>,
      progressNode
    );
    spinnerStart = Date.now();
  }, TWO_SECONDS);

  // Note: any task we put here needs to have its own safety valve; this function will
  //   show a spinner until it's done
  try {
    log.info(`longRunningTaskWrapper/${idLog}: Starting task`);
    const result = await task();
    log.info(`longRunningTaskWrapper/${idLog}: Task completed successfully`);

    clearTimeoutIfNecessary(progressTimeout);
    progressTimeout = undefined;
    if (progressNode) {
      const now = Date.now();
      if (spinnerStart && now - spinnerStart < ONE_SECOND) {
        log.info(
          `longRunningTaskWrapper/${idLog}: Spinner shown for less than second, showing for another second`
        );
        await sleep(ONE_SECOND);
      }
      unmountComponentAtNode(progressNode);
      progressNode = undefined;
    }

    return result;
  } catch (error) {
    log.error(
      `longRunningTaskWrapper/${idLog}: Error!`,
      Errors.toLogFormat(error)
    );

    clearTimeoutIfNecessary(progressTimeout);
    progressTimeout = undefined;
    if (progressNode) {
      unmountComponentAtNode(progressNode);
      progressNode = undefined;
    }

    if (!suppressErrorDialog) {
      log.info(`longRunningTaskWrapper/${idLog}: Showing error dialog`);
      window.reduxActions.globalModals.showErrorModal({});
    }

    throw error;
  }
}
