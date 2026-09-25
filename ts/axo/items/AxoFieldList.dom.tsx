// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, ReactNode } from 'react';
import { memo } from 'react';
import { AxoList } from './AxoList.dom.tsx';
import { AxoBaseField } from '../fields/_AxoBaseField.dom.tsx';

export namespace AxoFieldList {
  /**
   * <AxoFieldList.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    title?: ReactNode;
    description?: ReactNode;
    footerDescription?: ReactNode;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AxoList.Root>
        {props.title != null && (
          <AxoList.Header>
            <AxoList.Label>{props.title}</AxoList.Label>
            {/* We probably don't ever want to show a description without a title */}
            {props.description != null && (
              <AxoList.Description>{props.description}</AxoList.Description>
            )}
          </AxoList.Header>
        )}
        <AxoList.Body>{props.children}</AxoList.Body>
        {props.footerDescription != null && (
          <AxoList.Footer>
            <AxoList.FooterDescription>
              {props.footerDescription}
            </AxoList.FooterDescription>
          </AxoList.Footer>
        )}
      </AxoList.Root>
    );
  });

  Root.displayName = 'AxoFieldList.Root';

  /**
   * <AxoFieldList.Root>
   * --------------------------------------------------------------------------
   */

  export type ItemProps = Readonly<{
    children: ReactNode;
  }>;

  export const Item: FC<ItemProps> = memo(props => {
    return (
      <div className="axo-field-list-item">
        <AxoBaseField.VariantOverride variant="listitem">
          {props.children}
        </AxoBaseField.VariantOverride>
      </div>
    );
  });

  Item.displayName = 'AxoFieldList.Item';
}
