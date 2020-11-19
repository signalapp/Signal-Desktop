// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { LocalizerType } from '../types/Util';
import { Tooltip } from './Tooltip';

export type PropsType = {
  canPip?: boolean;
  conversationTitle: JSX.Element | string;
  i18n: LocalizerType;
  isGroupCall?: boolean;
  remoteParticipants?: number;
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
          >
            <button
              aria-label={i18n('calling__participants', [
                String(remoteParticipants),
              ])}
              className="module-calling-button__participants"
              onClick={toggleParticipants}
              type="button"
            />
          </Tooltip>
        </div>
      ) : null}
      <div className="module-calling-tools__button">
        <Tooltip content={i18n('callingDeviceSelection__settings')}>
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
          <Tooltip content={i18n('calling__pip--on')}>
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
