// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React from 'react';
import { AxoAlertDialog } from '../../../axo/AxoAlertDialog.dom.js';

export function DeleteChatFolderDialog(props: {
  title: string;
  description: ReactNode;
  cancelText: string;
  deleteText: string;
  onConfirm: () => void;
}): JSX.Element {
  return (
    <AxoAlertDialog.Content escape="cancel-is-noop">
      <AxoAlertDialog.Body>
        <AxoAlertDialog.Title>{props.title}</AxoAlertDialog.Title>
        <AxoAlertDialog.Description>
          {props.description}
        </AxoAlertDialog.Description>
      </AxoAlertDialog.Body>
      <AxoAlertDialog.Footer>
        <AxoAlertDialog.Cancel>{props.cancelText}</AxoAlertDialog.Cancel>
        <AxoAlertDialog.Action variant="destructive" onClick={props.onConfirm}>
          {props.deleteText}
        </AxoAlertDialog.Action>
      </AxoAlertDialog.Footer>
    </AxoAlertDialog.Content>
  );
}
