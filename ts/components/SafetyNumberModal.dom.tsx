// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { isSafetyNumberNotAvailable } from '../util/isSafetyNumberNotAvailable.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { LocalizerType } from '../types/Util.std.js';
import { AxoDialog } from '../axo/AxoDialog.dom.js';
import type { SafetyNumberProps as SafetyNumberViewerPropsType } from './SafetyNumberChangeDialog.dom.js';
import { SafetyNumberNotReady } from './SafetyNumberNotReady.dom.js';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  contact: ConversationType;
  toggleSafetyNumberModal: () => unknown;
  renderSafetyNumberViewer: (props: SafetyNumberViewerPropsType) => JSX.Element;
}>;

export function SafetyNumberModal({
  i18n,
  contact,
  toggleSafetyNumberModal,
  renderSafetyNumberViewer,
}: PropsType): React.JSX.Element | null {
  let title: string | undefined;
  let content: React.JSX.Element;
  let hasXButton = true;
  if (isSafetyNumberNotAvailable(contact)) {
    content = (
      <SafetyNumberNotReady
        i18n={i18n}
        onClose={() => toggleSafetyNumberModal()}
      />
    );
    hasXButton = false;
  } else {
    title = i18n('icu:SafetyNumberModal__title');

    content = renderSafetyNumberViewer({
      contactID: contact.id,
      onClose: toggleSafetyNumberModal,
    });
  }

  return (
    <AxoDialog.Root
      open
      onOpenChange={open => {
        if (!open) {
          toggleSafetyNumberModal();
        }
      }}
    >
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>{title}</AxoDialog.Title>
          {hasXButton && <AxoDialog.Close aria-label={i18n('icu:close')} />}
        </AxoDialog.Header>
        <AxoDialog.Body maxHeight={560}>{content}</AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
