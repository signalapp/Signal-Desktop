// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { LocalizerType } from '../types/Util';
import { Tooltip } from './Tooltip';
import { Theme } from '../util/theme';

export type PropsType = {
  canPip?: boolean;
  i18n: LocalizerType;
  isGroupCall?: boolean;
  message?: string;
  participantCount: number;
  showParticipantsList: boolean;
  title?: string;
  toggleParticipants?: () => void;
  togglePip?: () => void;
  toggleSettings: () => void;
};

export const CallingHeader = ({
  canPip = false,
  i18n,
  isGroupCall = false,
  message,
  participantCount,
  showParticipantsList,
  title,
  toggleParticipants,
  togglePip,
  toggleSettings,
}: PropsType): JSX.Element => (
  <div className="module-calling__header">
    {title ? (
      <div className="module-calling__header--header-name">{title}</div>
    ) : null}
    {message ? (
      <div className="module-ongoing-call__header-message">{message}</div>
    ) : null}
    <div className="module-calling-tools">
      {isGroupCall ? (
        <div className="module-calling-tools__button">
          <Tooltip
            content={i18n('calling__participants', [String(participantCount)])}
            theme={Theme.Dark}
          >
            <button
              aria-label={i18n('calling__participants', [
                String(participantCount),
              ])}
              className={classNames(
                'module-calling-button__participants--container',
                {
                  'module-calling-button__participants--shown': showParticipantsList,
                }
              )}
              onClick={toggleParticipants}
              type="button"
            >
              <i className="module-calling-button__participants" />
              <span className="module-calling-button__participants--count">
                {participantCount}
              </span>
            </button>
          </Tooltip>
        </div>
      ) : null}
      <div className="module-calling-tools__button">
        <Tooltip
          content={i18n('callingDeviceSelection__settings')}
          theme={Theme.Dark}
        >
          <button
            aria-label={i18n('callingDeviceSelection__settings')}
            className="module-calling-button__settings"
            onClick={toggleSettings}
            type="button"
          />
        </Tooltip>
      </div>
      {canPip && (
        <div className="module-calling-tools__button">
          <Tooltip content={i18n('calling__pip--on')} theme={Theme.Dark}>
            <button
              aria-label={i18n('calling__pip--on')}
              className="module-calling-button__pip"
              onClick={togglePip}
              type="button"
            />
          </Tooltip>
        </div>
      )}
    </div>
  </div>
);
