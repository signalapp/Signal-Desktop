// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This file is here temporarily while we're switching off of Backbone into
// React. In the future, and in React-land, please just import and use
// the component directly. This is the thin API layer to bridge the gap
// while we convert things over. Please delete this file once all usages are
// ported over.

import React from 'react';
import { unmountComponentAtNode, render } from 'react-dom';
import type { ConversationModel } from '../models/conversations';
import { SafetyNumberChangeDialog } from '../components/SafetyNumberChangeDialog';
import { getPreferredBadgeSelector } from '../state/selectors/badges';
import { getTheme } from '../state/selectors/user';

export type SafetyNumberChangeViewProps = {
  confirmText?: string;
  contacts: Array<ConversationModel>;
  reject: () => void;
  resolve: () => void;
};

let dialogContainerNode: HTMLElement | undefined;

function removeDialog() {
  if (!dialogContainerNode) {
    return;
  }

  unmountComponentAtNode(dialogContainerNode);
  document.body.removeChild(dialogContainerNode);

  dialogContainerNode = undefined;
}

export function showSafetyNumberChangeDialog(
  options: SafetyNumberChangeViewProps
): void {
  if (dialogContainerNode) {
    removeDialog();
  }

  dialogContainerNode = document.createElement('div');
  document.body.appendChild(dialogContainerNode);

  const reduxState = window.reduxStore.getState();
  const getPreferredBadge = getPreferredBadgeSelector(reduxState);
  const theme = getTheme(reduxState);

  render(
    <SafetyNumberChangeDialog
      confirmText={options.confirmText}
      contacts={options.contacts.map(contact => contact.format())}
      getPreferredBadge={getPreferredBadge}
      i18n={window.i18n}
      onCancel={() => {
        options.reject();
        removeDialog();
      }}
      onConfirm={() => {
        options.resolve();
        removeDialog();
      }}
      renderSafetyNumber={props => {
        return window.Signal.State.Roots.createSafetyNumberViewer(
          window.reduxStore,
          props
        );
      }}
      theme={theme}
    />,
    dialogContainerNode
  );
}
