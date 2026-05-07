// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, JSX } from 'react';
import { AxoAlertDialog } from '../../../axo/AxoAlertDialog.dom.tsx';

export function DeleteChatFolderDialog(props: {
  title: string;
  description: ReactNode;
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
        <AxoAlertDialog.Cancel />
        <AxoAlertDialog.Action variant="destructive" onClick={props.onConfirm}>
          {props.deleteText}
        </AxoAlertDialog.Action>
      </AxoAlertDialog.Footer>
    </AxoAlertDialog.Content>
  );
}
