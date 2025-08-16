// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';

import { Modal } from './Modal';
import type { LocalizerType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';
import { Button } from './Button';

export type PropsType = {
  i18n: LocalizerType;
  mediaType: 'camera' | 'microphone';
  requestor: 'call' | 'voiceNote';
  openSystemMediaPermissions: (mediaType: 'camera' | 'microphone') => void;
  onClose: () => void;
};

export function MediaPermissionsModal({
  i18n,
  mediaType,
  requestor,
  openSystemMediaPermissions,
  onClose,
}: PropsType): JSX.Element {
  let title: string;
  if (mediaType === 'camera') {
    title = i18n('icu:MediaPermissionsModal__title--camera');
  } else if (mediaType === 'microphone') {
    title = i18n('icu:MediaPermissionsModal__title--microphone');
  } else {
    throw missingCaseError(mediaType);
  }
  let subtitle: string;
  if (requestor === 'call') {
    if (mediaType === 'camera') {
      subtitle = i18n('icu:MediaPermissionsModal__subtitle--call--camera');
    } else if (mediaType === 'microphone') {
      subtitle = i18n('icu:MediaPermissionsModal__subtitle--call');
    } else {
      throw missingCaseError(mediaType);
    }
  } else if (requestor === 'voiceNote') {
    subtitle = i18n('icu:MediaPermissionsModal__subtitle--voice-note');
  } else {
    throw missingCaseError(requestor);
  }

  const onClick = useCallback(
    () => openSystemMediaPermissions(mediaType),
    [openSystemMediaPermissions, mediaType]
  );

  return (
    <Modal
      modalName="MediaPermissionsModal"
      hasXButton
      i18n={i18n}
      onClose={onClose}
      moduleClassName="MediaPermissionsModal"
    >
      <div className="MediaPermissionsModal__body">
        <h1>{title}</h1>
        <p className="MediaPermissionsModal__subtitle">{subtitle}</p>
        <ol>
          <li>
            {i18n('icu:MediaPermissionsModal__step-1', {
              buttonName: i18n('icu:MediaPermissionsModal__open'),
            })}
          </li>
          <li>
            <img alt="" src="images/macos-switch.svg" width={28} height={17} />
            {i18n('icu:MediaPermissionsModal__step-2')}
          </li>
        </ol>
        <Button onClick={onClick}>
          {i18n('icu:MediaPermissionsModal__open')}
        </Button>
      </div>
    </Modal>
  );
}
