// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';

import { AxoList } from '../../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../../axo/items/AxoItem.dom.tsx';

type PreferencesListProps = Readonly<{
  accessibilityLabel?: string;
  label?: string;
  footerDescription?: ReactNode;
  children: ReactNode;
}>;

export function PreferencesList(props: PreferencesListProps): ReactNode {
  return (
    <AxoList.Root accessibilityLabel={props.accessibilityLabel}>
      {props.label != null && (
        <AxoList.Header>
          <AxoList.Label>{props.label}</AxoList.Label>
        </AxoList.Header>
      )}
      <AxoList.Body>
        <AxoItem.Group>{props.children}</AxoItem.Group>
      </AxoList.Body>
      {props.footerDescription != null && (
        <AxoList.Footer>
          <AxoList.FooterDescription>
            {props.footerDescription}
          </AxoList.FooterDescription>
        </AxoList.Footer>
      )}
    </AxoList.Root>
  );
}
