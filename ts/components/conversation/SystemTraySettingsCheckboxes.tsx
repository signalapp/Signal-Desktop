// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEvent, FunctionComponent } from 'react';
import React, { useState } from 'react';
import {
  SystemTraySetting,
  parseSystemTraySetting,
  shouldMinimizeToSystemTray,
} from '../../types/SystemTraySetting';
import type { LocalizerType } from '../../types/Util';

type PropsType = {
  i18n: LocalizerType;
  initialValue: string;
  isSystemTraySupported: boolean;
  onChange: (value: SystemTraySetting) => unknown;
};

// This component is rendered by Backbone, so it deviates from idiomatic React a bit. For
//   example, it does not receive its value as a prop.
export const SystemTraySettingsCheckboxes: FunctionComponent<PropsType> = ({
  i18n,
  initialValue,
  isSystemTraySupported,
  onChange,
}) => {
  const [localValue, setLocalValue] = useState<SystemTraySetting>(
    parseSystemTraySetting(initialValue)
  );

  if (!isSystemTraySupported) {
    return null;
  }

  const setValue = (value: SystemTraySetting): void => {
    setLocalValue(oldValue => {
      if (oldValue !== value) {
        onChange(value);
      }
      return value;
    });
  };

  const setMinimizeToSystemTray = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(
      event.target.checked
        ? SystemTraySetting.MinimizeToSystemTray
        : SystemTraySetting.DoNotUseSystemTray
    );
  };

  const setMinimizeToAndStartInSystemTray = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setValue(
      event.target.checked
        ? SystemTraySetting.MinimizeToAndStartInSystemTray
        : SystemTraySetting.MinimizeToSystemTray
    );
  };

  const minimizesToTray = shouldMinimizeToSystemTray(localValue);
  const minimizesToAndStartsInSystemTray =
    localValue === SystemTraySetting.MinimizeToAndStartInSystemTray;

  return (
    <>
      <div>
        <input
          checked={minimizesToTray}
          id="system-tray-setting-minimize-to-system-tray"
          onChange={setMinimizeToSystemTray}
          type="checkbox"
        />
        {/* These manual spaces mirror the non-React parts of the settings screen. */}{' '}
        <label htmlFor="system-tray-setting-minimize-to-system-tray">
          {i18n('SystemTraySetting__minimize-to-system-tray')}
        </label>
      </div>
      <div>
        <input
          checked={minimizesToAndStartsInSystemTray}
          disabled={!minimizesToTray}
          id="system-tray-setting-minimize-to-and-start-in-system-tray"
          onChange={setMinimizeToAndStartInSystemTray}
          type="checkbox"
        />{' '}
        {/* These styles should live in CSS, but because we intend to rewrite the settings
            screen, this inline CSS limits the scope of the future rewrite. */}
        <label
          htmlFor="system-tray-setting-minimize-to-and-start-in-system-tray"
          style={minimizesToTray ? {} : { opacity: 0.75 }}
        >
          {i18n('SystemTraySetting__minimize-to-and-start-in-system-tray')}
        </label>
      </div>
    </>
  );
};
