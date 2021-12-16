// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React, { useRef } from 'react';

import type { LocalizerType } from '../../types/Util';
import { normalizeDeviceName } from '../../util/normalizeDeviceName';

import { Button, ButtonVariant } from '../Button';
import { TitlebarDragArea } from '../TitlebarDragArea';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo';

// This is the string's `.length`, which is the number of UTF-16 code points. Instead, we
//   want this to be either 50 graphemes or 256 encrypted bytes, whichever is smaller. See
//   DESKTOP-2844.
export const MAX_DEVICE_NAME_LENGTH = 50;

type PropsType = {
  deviceName: string;
  i18n: LocalizerType;
  onSubmit: () => void;
  setDeviceName: (value: string) => void;
};

export function InstallScreenChoosingDeviceNameStep({
  deviceName,
  i18n,
  onSubmit,
  setDeviceName,
}: Readonly<PropsType>): ReactElement {
  const hasFocusedRef = useRef<boolean>(false);
  const focusRef = (el: null | HTMLElement) => {
    if (el) {
      el.focus();
      hasFocusedRef.current = true;
    }
  };

  const normalizedName = normalizeDeviceName(deviceName);
  const canSubmit =
    normalizedName.length > 0 &&
    normalizedName.length <= MAX_DEVICE_NAME_LENGTH;

  return (
    <form
      className="module-InstallScreenChoosingDeviceNameStep"
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <TitlebarDragArea />

      <InstallScreenSignalLogo />

      <div className="module-InstallScreenChoosingDeviceNameStep__contents">
        <div className="module-InstallScreenChoosingDeviceNameStep__header">
          <h1>{i18n('chooseDeviceName')}</h1>
          <h2>{i18n('Install__choose-device-name__description')}</h2>
        </div>
        <div className="module-InstallScreenChoosingDeviceNameStep__inputs">
          <input
            className="module-InstallScreenChoosingDeviceNameStep__input"
            maxLength={MAX_DEVICE_NAME_LENGTH}
            onChange={event => {
              setDeviceName(event.target.value);
            }}
            placeholder={i18n('Install__choose-device-name__placeholder')}
            ref={focusRef}
            spellCheck={false}
            value={deviceName}
          />
          <Button
            disabled={!canSubmit}
            variant={ButtonVariant.Primary}
            type="submit"
          >
            {i18n('finishLinkingPhone')}
          </Button>
        </div>
      </div>
    </form>
  );
}
