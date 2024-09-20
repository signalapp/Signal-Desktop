// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Button, ButtonVariant } from './Button';
import type { LocalizerType } from '../types/Util';
import { ScreenShareStatus } from '../types/Calling';

export type PropsType = {
  i18n: LocalizerType;
  onCloseController: () => unknown;
  onStopSharing: () => unknown;
  status: ScreenShareStatus;
  presentedSourceName: string | undefined;
};

export function CallingScreenSharingController({
  i18n,
  onCloseController,
  onStopSharing,
  status,
  presentedSourceName,
}: PropsType): JSX.Element {
  let text: string;

  if (status === ScreenShareStatus.Reconnecting) {
    text = i18n('icu:calling__presenting--reconnecting');
  } else if (presentedSourceName) {
    text = i18n('icu:calling__presenting--info', {
      window: presentedSourceName,
    });
  } else {
    text = i18n('icu:calling__presenting--info--unknown');
  }

  return (
    <div className="module-CallingScreenSharingController">
      <div className="module-CallingScreenSharingController__text">{text}</div>
      <div className="module-CallingScreenSharingController__buttons">
        <Button
          className="module-CallingScreenSharingController__button"
          onClick={onStopSharing}
          variant={ButtonVariant.Destructive}
        >
          {i18n('icu:calling__presenting--stop')}
        </Button>
        <button
          aria-label={i18n('icu:close')}
          className="module-CallingScreenSharingController__close"
          onClick={onCloseController}
          type="button"
        />
      </div>
    </div>
  );
}
