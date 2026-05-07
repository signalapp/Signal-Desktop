// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, MouseEvent, ReactElement, ReactNode } from 'react';
import { memo } from 'react';
import { AxoAlertDialog } from './AxoAlertDialog.dom.tsx';

export namespace AxoConfirmDialog {
  /**
   * <AxoConfirmDialog.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string | ReactElement;
    description: string | ReactElement;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AxoAlertDialog.Root open={props.open} onOpenChange={props.onOpenChange}>
        <AxoAlertDialog.Content escape="cancel-is-destructive">
          <AxoAlertDialog.Body>
            <AxoAlertDialog.Title>{props.title}</AxoAlertDialog.Title>
            <AxoAlertDialog.Description>
              {props.description}
            </AxoAlertDialog.Description>
          </AxoAlertDialog.Body>
          <AxoAlertDialog.Footer>{props.children}</AxoAlertDialog.Footer>
        </AxoAlertDialog.Content>
      </AxoAlertDialog.Root>
    );
  });

  Root.displayName = `AxoConfirmDialog.Root`;

  /**
   * <AxoConfirmDialog.Root>
   * --------------------------------------------------------------------------
   */

  export type CancelProps = Readonly<{
    children?: string | ReactElement | null;
  }>;

  export const Cancel: FC<CancelProps> = memo(props => {
    return <AxoAlertDialog.Cancel>{props.children}</AxoAlertDialog.Cancel>;
  });

  Cancel.displayName = 'AxoConfirmDialog.Cancel';

  /**
   * <AxoConfirmDialog.Root>
   * --------------------------------------------------------------------------
   */

  export type ActionProps = Readonly<{
    variant: 'primary' | 'destructive' | 'secondary';
    disabled?: boolean;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    children: ReactNode;
  }>;

  export const Action: FC<ActionProps> = memo(props => {
    return (
      <AxoAlertDialog.Action
        variant={props.variant}
        disabled={props.disabled}
        onClick={props.onClick}
      >
        {props.children}
      </AxoAlertDialog.Action>
    );
  });

  Action.displayName = 'AxoConfirmDialog.Action';
}
