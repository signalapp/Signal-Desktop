// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { ReactWrapperView } from '../views/ReactWrapperView';
import { ErrorModal } from '../components/ErrorModal';
import { ProgressModal } from '../components/ProgressModal';
import * as log from '../logging/log';
import { clearTimeoutIfNecessary } from './clearTimeoutIfNecessary';

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

  let progressView: Backbone.View | undefined;
  let spinnerStart;
  let progressTimeout: NodeJS.Timeout | undefined = setTimeout(() => {
    log.info(`longRunningTaskWrapper/${idLog}: Creating spinner`);

    // Note: this component uses a portal to render itself into the top-level DOM. No
    //   need to attach it to the DOM here.
    progressView = new ReactWrapperView({
      className: 'progress-modal-wrapper',
      JSX: <ProgressModal i18n={window.i18n} />,
    });
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
    if (progressView) {
      const now = Date.now();
      if (spinnerStart && now - spinnerStart < ONE_SECOND) {
        log.info(
          `longRunningTaskWrapper/${idLog}: Spinner shown for less than second, showing for another second`
        );
        await window.Signal.Util.sleep(ONE_SECOND);
      }
      progressView.remove();
      progressView = undefined;
    }

    return result;
  } catch (error) {
    log.error(
      `longRunningTaskWrapper/${idLog}: Error!`,
      error && error.stack ? error.stack : error
    );

    clearTimeoutIfNecessary(progressTimeout);
    progressTimeout = undefined;
    if (progressView) {
      progressView.remove();
      progressView = undefined;
    }

    if (!suppressErrorDialog) {
      log.info(`longRunningTaskWrapper/${idLog}: Showing error dialog`);

      // Note: this component uses a portal to render itself into the top-level DOM. No
      //   need to attach it to the DOM here.
      const errorView: Backbone.View = new ReactWrapperView({
        className: 'error-modal-wrapper',
        JSX: (
          <ErrorModal
            i18n={window.i18n}
            onClose={() => {
              errorView.remove();
            }}
          />
        ),
      });
    }

    throw error;
  }
}
