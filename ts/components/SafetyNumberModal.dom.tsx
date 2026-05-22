// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, ReactNode } from 'react';
import { isSafetyNumberNotAvailable } from '../util/isSafetyNumberNotAvailable.std.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import type { SafetyNumberProps as SafetyNumberViewerPropsType } from './SafetyNumberChangeDialog.dom.tsx';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser.dom.ts';
import { SAFETY_NUMBER_URL } from '../types/support.std.ts';

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
}: PropsType): JSX.Element | null {
  let title: string | undefined;
  let content: ReactNode;
  let actions: ReactNode;
  let hasXButton = true;

  function onLearnMore() {
    openLinkInWebBrowser(SAFETY_NUMBER_URL);
  }

  if (isSafetyNumberNotAvailable(contact)) {
    content = (
      <AxoDialog.Description>
        {i18n('icu:SafetyNumberNotReady__body')}
      </AxoDialog.Description>
    );
    actions = (
      <AxoDialog.Actions>
        <AxoDialog.Action variant="secondary" onClick={onLearnMore}>
          {i18n('icu:SafetyNumberNotReady__learn-more')}
        </AxoDialog.Action>
        <AxoDialog.Action variant="secondary" onClick={toggleSafetyNumberModal}>
          {i18n('icu:ok')}
        </AxoDialog.Action>
      </AxoDialog.Actions>
    );
    hasXButton = false;
  } else {
    title = i18n('icu:SafetyNumberModal__title');
    content = renderSafetyNumberViewer({
      contactID: contact.id,
      onClose: toggleSafetyNumberModal,
    });
    actions = null;
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
          {hasXButton && <AxoDialog.Close />}
        </AxoDialog.Header>
        <AxoDialog.Body maxHeight={560}>{content}</AxoDialog.Body>
        <AxoDialog.Footer>{actions}</AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
