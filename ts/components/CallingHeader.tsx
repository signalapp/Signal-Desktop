// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactNode } from 'react';
import classNames from 'classnames';
import { LocalizerType } from '../types/Util';
import { Tooltip } from './Tooltip';
import { Theme } from '../util/theme';

export type PropsType = {
  i18n: LocalizerType;
  isInSpeakerView?: boolean;
  isGroupCall?: boolean;
  message?: ReactNode;
  onCancel?: () => void;
  participantCount: number;
  showParticipantsList: boolean;
  title?: string;
  toggleParticipants?: () => void;
  togglePip?: () => void;
  toggleSettings: () => void;
  toggleSpeakerView?: () => void;
};

export const CallingHeader = ({
  i18n,
  isInSpeakerView,
  isGroupCall = false,
  message,
  onCancel,
  participantCount,
  showParticipantsList,
  title,
  toggleParticipants,
  togglePip,
  toggleSettings,
  toggleSpeakerView,
}: PropsType): JSX.Element => (
  <div className="module-calling__header">
    {title ? (
      <div className="module-calling__header--header-name">{title}</div>
    ) : null}
    {message ? (
      <div className="module-ongoing-call__header-message">{message}</div>
    ) : null}
    <div className="module-calling-tools">
      {participantCount ? (
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
      {isGroupCall && participantCount > 2 && toggleSpeakerView && (
        <div className="module-calling-tools__button">
          <Tooltip
            content={i18n(
              isInSpeakerView
                ? 'calling__switch-view--to-grid'
                : 'calling__switch-view--to-speaker'
            )}
            theme={Theme.Dark}
          >
            <button
              aria-label={i18n(
                isInSpeakerView
                  ? 'calling__switch-view--to-grid'
                  : 'calling__switch-view--to-speaker'
              )}
              className={
                isInSpeakerView
                  ? 'module-calling-button__grid-view'
                  : 'module-calling-button__speaker-view'
              }
              onClick={toggleSpeakerView}
              type="button"
            />
          </Tooltip>
        </div>
      )}
      {togglePip && (
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
      {onCancel && (
        <div className="module-calling-tools__button">
          <Tooltip content={i18n('cancel')} theme={Theme.Dark}>
            <button
              aria-label={i18n('cancel')}
              className="module-calling-button__cancel"
              onClick={onCancel}
              type="button"
            />
          </Tooltip>
        </div>
      )}
    </div>
  </div>
);
