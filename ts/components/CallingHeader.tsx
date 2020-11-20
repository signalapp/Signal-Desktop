// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { LocalizerType } from '../types/Util';
import { Tooltip, TooltipTheme } from './Tooltip';

export type PropsType = {
  canPip?: boolean;
  conversationTitle: JSX.Element | string;
  i18n: LocalizerType;
  isGroupCall?: boolean;
  remoteParticipants?: number;
  showParticipantsList: boolean;
  toggleParticipants?: () => void;
  togglePip?: () => void;
  toggleSettings: () => void;
};

export const CallingHeader = ({
  canPip = false,
  conversationTitle,
  i18n,
  isGroupCall = false,
  remoteParticipants,
  showParticipantsList,
  toggleParticipants,
  togglePip,
  toggleSettings,
}: PropsType): JSX.Element => (
  <div className="module-calling__header">
    <div className="module-calling__header--header-name">
      {conversationTitle}
    </div>
    <div className="module-calling-tools">
      {isGroupCall ? (
        <div className="module-calling-tools__button">
          <Tooltip
            content={i18n('calling__participants', [
              String(remoteParticipants),
            ])}
            theme={TooltipTheme.Dark}
          >
            <button
              aria-label={i18n('calling__participants', [
                String(remoteParticipants),
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
                {remoteParticipants}
              </span>
            </button>
          </Tooltip>
        </div>
      ) : null}
      <div className="module-calling-tools__button">
        <Tooltip
          content={i18n('callingDeviceSelection__settings')}
          theme={TooltipTheme.Dark}
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
          <Tooltip content={i18n('calling__pip--on')} theme={TooltipTheme.Dark}>
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
