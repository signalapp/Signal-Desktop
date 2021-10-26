// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Button, ButtonVariant } from './Button';
import type { LocalizerType } from '../types/Util';

export type PropsType = {
  i18n: LocalizerType;
  onCloseController: () => unknown;
  onStopSharing: () => unknown;
  presentedSourceName: string;
};

export const CallingScreenSharingController = ({
  i18n,
  onCloseController,
  onStopSharing,
  presentedSourceName,
}: PropsType): JSX.Element => {
  return (
    <div className="module-CallingScreenSharingController">
      <div className="module-CallingScreenSharingController__text">
        {i18n('calling__presenting--info', [presentedSourceName])}
      </div>
      <div className="module-CallingScreenSharingController__buttons">
        <Button
          className="module-CallingScreenSharingController__button"
          onClick={onStopSharing}
          variant={ButtonVariant.Destructive}
        >
          {i18n('calling__presenting--stop')}
        </Button>
        <button
          aria-label={i18n('close')}
          className="module-CallingScreenSharingController__close"
          onClick={onCloseController}
          type="button"
        />
      </div>
    </div>
  );
};
