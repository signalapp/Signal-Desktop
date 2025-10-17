// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import React from 'react';
import type { ShowToastAction } from '../../state/ducks/toast.preload.js';
import { ToastType } from '../../types/Toast.dom.js';
import type { LocalizerType } from '../../types/Util.std.js';

// Keep this in sync with iOS and Android
const MAX_FORWARD_COUNT = 30;

type SelectModeActionsProps = Readonly<{
  selectedMessageIds: ReadonlyArray<string>;
  areSelectedMessagesForwardable: boolean;
  onExitSelectMode: () => void;
  onDeleteMessages: () => void;
  onForwardMessages: () => void;
  showToast: ShowToastAction;
  i18n: LocalizerType;
}>;

export default function SelectModeActions({
  selectedMessageIds,
  areSelectedMessagesForwardable,
  onExitSelectMode,
  onDeleteMessages,
  onForwardMessages,
  showToast,
  i18n,
}: SelectModeActionsProps): JSX.Element {
  const hasSelectedMessages = selectedMessageIds.length >= 1;
  const tooManyMessagesToForward =
    selectedMessageIds.length > MAX_FORWARD_COUNT;

  const canForward =
    hasSelectedMessages &&
    areSelectedMessagesForwardable &&
    !tooManyMessagesToForward;
  const canDelete = hasSelectedMessages;

  return (
    <div className="SelectModeActions">
      <button
        type="button"
        className="SelectModeActions__button"
        onClick={onExitSelectMode}
        aria-label={i18n('icu:SelectModeActions--exitSelectMode')}
      >
        <span
          role="presentation"
          className="SelectModeActions__icon SelectModeActions__icon--exitSelectMode"
        />
      </button>
      <div className="SelectModeActions__selectedMessages">
        {i18n('icu:SelectModeActions--selectedMessages', {
          count: selectedMessageIds.length,
        })}
      </div>
      <button
        type="button"
        className={classNames('SelectModeActions__button', {
          'SelectModeActions__button--disabled': !canDelete,
        })}
        disabled={!canDelete}
        onClick={onDeleteMessages}
        aria-label={i18n('icu:SelectModeActions--deleteSelectedMessages')}
      >
        <span
          role="presentation"
          className="SelectModeActions__icon SelectModeActions__icon--deleteSelectedMessages"
        />
      </button>
      <button
        type="button"
        className={classNames('SelectModeActions__button', {
          'SelectModeActions__button--disabled': !canForward,
        })}
        aria-disabled={!canForward}
        onClick={() => {
          if (canForward) {
            onForwardMessages();
          } else if (tooManyMessagesToForward) {
            showToast({ toastType: ToastType.TooManyMessagesToForward });
          }
        }}
        aria-label={i18n('icu:SelectModeActions--forwardSelectedMessages')}
      >
        <span
          role="presentation"
          className="SelectModeActions__icon SelectModeActions__icon--forwardSelectedMessages"
        />
      </button>
    </div>
  );
}
