// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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

  let progressView: typeof window.Whisper.ReactWrapperView | undefined;
  let spinnerStart;
  let progressTimeout: NodeJS.Timeout | undefined = setTimeout(() => {
    window.log.info(`longRunningTaskWrapper/${idLog}: Creating spinner`);

    // Note: this component uses a portal to render itself into the top-level DOM. No
    //   need to attach it to the DOM here.
    progressView = new window.Whisper.ReactWrapperView({
      className: 'progress-modal-wrapper',
      Component: window.Signal.Components.ProgressModal,
    });
    spinnerStart = Date.now();
  }, TWO_SECONDS);

  // Note: any task we put here needs to have its own safety valve; this function will
  //   show a spinner until it's done
  try {
    window.log.info(`longRunningTaskWrapper/${idLog}: Starting task`);
    const result = await task();
    window.log.info(
      `longRunningTaskWrapper/${idLog}: Task completed successfully`
    );

    if (progressTimeout) {
      clearTimeout(progressTimeout);
      progressTimeout = undefined;
    }
    if (progressView) {
      const now = Date.now();
      if (spinnerStart && now - spinnerStart < ONE_SECOND) {
        window.log.info(
          `longRunningTaskWrapper/${idLog}: Spinner shown for less than second, showing for another second`
        );
        await window.Signal.Util.sleep(ONE_SECOND);
      }
      progressView.remove();
      progressView = undefined;
    }

    return result;
  } catch (error) {
    window.log.error(
      `longRunningTaskWrapper/${idLog}: Error!`,
      error && error.stack ? error.stack : error
    );

    if (progressTimeout) {
      clearTimeout(progressTimeout);
      progressTimeout = undefined;
    }
    if (progressView) {
      progressView.remove();
      progressView = undefined;
    }

    if (!suppressErrorDialog) {
      window.log.info(`longRunningTaskWrapper/${idLog}: Showing error dialog`);

      // Note: this component uses a portal to render itself into the top-level DOM. No
      //   need to attach it to the DOM here.
      const errorView = new window.Whisper.ReactWrapperView({
        className: 'error-modal-wrapper',
        Component: window.Signal.Components.ErrorModal,
        props: {
          onClose: () => errorView.remove(),
        },
      });
    }

    throw error;
  }
}
