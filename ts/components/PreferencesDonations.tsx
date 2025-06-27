// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useRef } from 'react';

import type { MutableRefObject } from 'react';

import type { LocalizerType } from '../types/Util';
import { useConfirmDiscard } from '../hooks/useConfirmDiscard';
import { PreferencesContent } from './Preferences';

type PropsExternalType = {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
};

export type PropsDataType = {
  i18n: LocalizerType;
};
// type PropsActionType = {};

export type PropsType = PropsDataType /* & PropsActionType */ &
  PropsExternalType;

export function PreferencesDonations({
  contentsRef,
  i18n,
}: PropsType): JSX.Element {
  const tryClose = useRef<() => void | undefined>();
  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard({
    i18n,
    name: 'PreferencesDonations',
    tryClose,
  });

  // TODO: only show back button when on a sub-page.
  // See ProfileEditor for its approach, an enum describing the current page
  // Note that we would want to then add that to nav/location stuff
  const backButton = (
    <button
      aria-label={i18n('icu:goBack')}
      className="Preferences__back-icon"
      onClick={() => /* TODO */ undefined}
      type="button"
    />
  );

  const onTryClose = useCallback(() => {
    // TODO: check to see if we're dirty before navigating away
    const isDirty = false;
    const onDiscard = () => {
      // clear data that the user had been working on, perhaps?
    };
    const onCancel = () => {
      // is there anything to do if the user cancels out of navigation?
    };

    confirmDiscardIf(isDirty, onDiscard, onCancel);
  }, [confirmDiscardIf]);
  tryClose.current = onTryClose;

  const content = 'Empty for now';

  return (
    <>
      {confirmDiscardModal}

      <PreferencesContent
        backButton={backButton}
        contents={<div className="PreferencesDonations">{content}</div>}
        contentsRef={contentsRef}
        title={i18n('icu:Preferences__DonateTitle')}
      />
    </>
  );
}
