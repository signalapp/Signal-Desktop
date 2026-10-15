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
import { SAFETY_NUMBER_VIEWER_DIALOG_BODY_MAX_HEIGHT } from './SafetyNumberViewer.dom.tsx';

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
  let content: ReactNode;
  let actions: ReactNode;
  let showTitle: boolean;
  let showClose: boolean;

  function onLearnMore() {
    openLinkInWebBrowser(SAFETY_NUMBER_URL);
  }

  if (isSafetyNumberNotAvailable(contact)) {
    showTitle = false;
    showClose = false;
    content = (
      <AxoDialog.Description>
        {i18n('icu:SafetyNumberNotReady__body')}
      </AxoDialog.Description>
    );
    actions = (
      <AxoDialog.Actions>
        <AxoDialog.Action
          variant="subtle-secondary"
          onClick={onLearnMore}
          arrow="external-link"
        >
          {i18n('icu:SafetyNumberNotReady__learn-more')}
        </AxoDialog.Action>
        <AxoDialog.Action
          variant="strong-primary"
          onClick={toggleSafetyNumberModal}
          autoFocus
        >
          {i18n('icu:ok')}
        </AxoDialog.Action>
      </AxoDialog.Actions>
    );
  } else {
    showTitle = true;
    showClose = true;
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
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header floating={!showTitle}>
          <AxoDialog.Title>
            {i18n('icu:SafetyNumberModal__title')}
          </AxoDialog.Title>
          {showClose && <AxoDialog.Close />}
        </AxoDialog.Header>
        <AxoDialog.Body maxHeight={SAFETY_NUMBER_VIEWER_DIALOG_BODY_MAX_HEIGHT}>
          {content}
        </AxoDialog.Body>
        {actions != null && <AxoDialog.Footer>{actions}</AxoDialog.Footer>}
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
