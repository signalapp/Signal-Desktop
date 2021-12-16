// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import type { LocalizerType } from '../../types/Util';
import { missingCaseError } from '../../util/missingCaseError';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser';
import { Button, ButtonVariant } from '../Button';
import { TitlebarDragArea } from '../TitlebarDragArea';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo';

export enum InstallError {
  TooManyDevices,
  TooOld,
  ConnectionFailed,
  UnknownError,
}

export function InstallScreenErrorStep({
  error,
  i18n,
  quit,
  tryAgain,
}: Readonly<{
  error: InstallError;
  i18n: LocalizerType;
  quit: () => unknown;
  tryAgain: () => unknown;
}>): ReactElement {
  let errorMessage: string;
  let buttonText = i18n('installTryAgain');
  let onClickButton = () => tryAgain();
  let shouldShowQuitButton = false;

  switch (error) {
    case InstallError.TooManyDevices:
      errorMessage = i18n('installTooManyDevices');
      break;
    case InstallError.TooOld:
      errorMessage = i18n('installTooOld');
      buttonText = i18n('upgrade');
      onClickButton = () => {
        openLinkInWebBrowser('https://signal.org/download');
      };
      shouldShowQuitButton = true;
      break;
    case InstallError.ConnectionFailed:
      errorMessage = i18n('installConnectionFailed');
      break;
    case InstallError.UnknownError:
      errorMessage = i18n('installUnknownError');
      break;
    default:
      throw missingCaseError(error);
  }

  return (
    <div className="module-InstallScreenErrorStep">
      <TitlebarDragArea />

      <InstallScreenSignalLogo />

      <h1>{i18n('installErrorHeader')}</h1>
      <h2>{errorMessage}</h2>

      <div className="module-InstallScreenErrorStep__buttons">
        <Button onClick={onClickButton}>{buttonText}</Button>
        {shouldShowQuitButton && (
          <Button onClick={() => quit()} variant={ButtonVariant.Secondary}>
            {i18n('quit')}
          </Button>
        )}
      </div>
    </div>
  );
}
