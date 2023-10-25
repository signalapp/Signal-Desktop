// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import classNames from 'classnames';
import type { LocalizerType } from '../types/Util';
import { Tooltip } from './Tooltip';
import { Theme } from '../util/theme';

export type PropsType = {
  i18n: LocalizerType;
  isInSpeakerView?: boolean;
  isGroupCall?: boolean;
  message?: ReactNode;
  onCancel?: () => void;
  participantCount: number;
  title?: string;
  togglePip?: () => void;
  toggleSettings: () => void;
  toggleSpeakerView?: () => void;
};

export function CallingHeader({
  i18n,
  isInSpeakerView,
  isGroupCall = false,
  message,
  onCancel,
  participantCount,
  title,
  togglePip,
  toggleSettings,
  toggleSpeakerView,
}: PropsType): JSX.Element {
  return (
    <div className="module-calling__header">
      {title ? (
        <div className="module-calling__header--header-name">{title}</div>
      ) : null}
      {message ? (
        <div className="module-ongoing-call__header-message">{message}</div>
      ) : null}
      <div className="module-calling-tools">
        {togglePip && (
          <div className="module-calling-tools__button">
            <Tooltip
              content={i18n('icu:calling__pip--on')}
              className="CallingButton__tooltip"
              theme={Theme.Dark}
            >
              <button
                aria-label={i18n('icu:calling__pip--on')}
                className="CallSettingsButton__Button"
                onClick={togglePip}
                type="button"
              >
                <span className="CallSettingsButton__Icon CallSettingsButton__Icon--Pip" />
              </button>
            </Tooltip>
          </div>
        )}
        {isGroupCall && participantCount > 2 && toggleSpeakerView && (
          <div className="module-calling-tools__button">
            <Tooltip
              content={
                isInSpeakerView
                  ? i18n('icu:calling__switch-view--to-grid')
                  : i18n('icu:calling__switch-view--to-speaker')
              }
              className="CallingButton__tooltip"
              theme={Theme.Dark}
            >
              <button
                aria-label={
                  isInSpeakerView
                    ? i18n('icu:calling__switch-view--to-grid')
                    : i18n('icu:calling__switch-view--to-speaker')
                }
                className="CallSettingsButton__Button"
                onClick={toggleSpeakerView}
                type="button"
              >
                <span
                  className={classNames(
                    'CallSettingsButton__Icon',
                    isInSpeakerView
                      ? 'CallSettingsButton__Icon--GridView'
                      : 'CallSettingsButton__Icon--SpeakerView'
                  )}
                />
              </button>
            </Tooltip>
          </div>
        )}
        <div className="module-calling-tools__button">
          <Tooltip
            content={i18n('icu:callingDeviceSelection__settings')}
            className="CallingButton__tooltip"
            theme={Theme.Dark}
          >
            <button
              aria-label={i18n('icu:callingDeviceSelection__settings')}
              className="CallSettingsButton__Button"
              onClick={toggleSettings}
              type="button"
            >
              <span className="CallSettingsButton__Icon CallSettingsButton__Icon--Settings" />
            </button>
          </Tooltip>
        </div>
        {onCancel && (
          <div className="module-calling-tools__button">
            <Tooltip
              content={i18n('icu:cancel')}
              theme={Theme.Dark}
              className="CallingButton__tooltip"
            >
              <button
                aria-label={i18n('icu:cancel')}
                className="CallSettingsButton__Button CallSettingsButton__Button--Cancel"
                onClick={onCancel}
                type="button"
              >
                <span className="CallSettingsButton__Icon CallSettingsButton__Icon--Cancel" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}
