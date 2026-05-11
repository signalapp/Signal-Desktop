// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, type JSX } from 'react';
import { tw } from '../axo/tw.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';

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
    <AxoAlertDialog.Root open onOpenChange={onClose}>
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>{title}</AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            <p className={tw('mb-2')}>{subtitle}</p>
            <ol className={tw('flex list-inside list-decimal flex-col gap-1')}>
              <li>
                {i18n('icu:MediaPermissionsModal__step-1', {
                  buttonName: i18n('icu:MediaPermissionsModal__open'),
                })}
              </li>
              <li>
                <img
                  className={tw('me-1 inline-block')}
                  alt=""
                  src="images/macos-switch.svg"
                  width={30}
                  height={20}
                />
                {i18n('icu:MediaPermissionsModal__step-2')}
              </li>
            </ol>
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Action variant="primary" onClick={onClick}>
            {i18n('icu:MediaPermissionsModal__open')}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
