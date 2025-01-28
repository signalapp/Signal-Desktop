// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactElement, useCallback } from 'react';

import type { LocalizerType } from '../../types/Util';
import { missingCaseError } from '../../util/missingCaseError';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser';
import { Button, ButtonVariant } from '../Button';
import { TitlebarDragArea } from '../TitlebarDragArea';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo';
import { LINK_SIGNAL_DESKTOP } from '../../types/support';
import { InstallScreenError } from '../../types/InstallScreen';

export type Props = Readonly<{
  error: InstallScreenError;
  i18n: LocalizerType;
  quit: () => unknown;
  tryAgain: () => unknown;
}>;

export function InstallScreenErrorStep({
  error,
  i18n,
  quit,
  tryAgain,
}: Props): ReactElement {
  let errorMessage: string;
  let buttonText = i18n('icu:installTryAgain');
  let onClickButton = useCallback(() => tryAgain(), [tryAgain]);
  let shouldShowQuitButton = false;

  switch (error) {
    case InstallScreenError.TooManyDevices:
      errorMessage = i18n('icu:installTooManyDevices');
      break;
    case InstallScreenError.TooOld:
      errorMessage = i18n('icu:installTooOld');
      buttonText = i18n('icu:upgrade');
      onClickButton = () => {
        openLinkInWebBrowser('https://signal.org/download');
      };
      shouldShowQuitButton = true;
      break;
    case InstallScreenError.ConnectionFailed:
      errorMessage = i18n('icu:installConnectionFailed');
      break;
    case InstallScreenError.QRCodeFailed:
      buttonText = i18n('icu:Install__learn-more');
      errorMessage = i18n('icu:installUnknownError');
      onClickButton = () => {
        openLinkInWebBrowser(LINK_SIGNAL_DESKTOP);
      };
      shouldShowQuitButton = true;
      break;
    default:
      throw missingCaseError(error);
  }

  return (
    <div className="module-InstallScreenErrorStep">
      <TitlebarDragArea />

      <InstallScreenSignalLogo />

      <h1>{i18n('icu:installErrorHeader')}</h1>
      <h2>{errorMessage}</h2>

      <div className="module-InstallScreenErrorStep__buttons">
        <Button onClick={onClickButton}>{buttonText}</Button>
        {shouldShowQuitButton && (
          <Button onClick={() => quit()} variant={ButtonVariant.Secondary}>
            {i18n('icu:quit')}
          </Button>
        )}
      </div>
    </div>
  );
}
