// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { I18n } from './I18n.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

export type SignalConnectionsModalProps = Readonly<{
  i18n: LocalizerType;
  onClose: () => unknown;
}>;

export function SignalConnectionsModal(
  props: SignalConnectionsModalProps
): ReactNode {
  const { i18n } = props;
  return (
    <AxoDialog.Root open onOpenChange={props.onClose}>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header floating>
          <AxoDialog.Title>
            {i18n('icu:SignalConnectionsModal__title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('mb-2.5 flex justify-center')}>
            <AxoSymbol.Icon label={null} symbol="connections" size={36} />
          </div>
          <AxoDialog.Description>
            <p className={tw('mb-2.5')}>
              <I18n
                components={{
                  connections: (
                    <strong>{i18n('icu:SignalConnectionsModal__title')}</strong>
                  ),
                }}
                i18n={i18n}
                id="icu:SignalConnectionsModal__header"
              />
            </p>
            <ul className={tw('mb-2.5 flex flex-col gap-2 ps-3')}>
              <ListItem>
                {i18n('icu:SignalConnectionsModal__bullet--1')}
              </ListItem>
              <ListItem>
                {i18n('icu:SignalConnectionsModal__bullet--2')}
              </ListItem>
              <ListItem>
                {i18n('icu:SignalConnectionsModal__bullet--3')}
              </ListItem>
            </ul>
            <p>{i18n('icu:SignalConnectionsModal__footer')}</p>
          </AxoDialog.Description>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

type ListItemProps = Readonly<{
  children: ReactNode;
}>;

function ListItem(props: ListItemProps): ReactNode {
  return (
    <li className={tw('flex items-center')}>
      <span
        className={tw(
          'me-4 inline-block h-lh w-1 rounded-md bg-tertiary align-middle',
          'forced-colors:bg-[CanvasText]'
        )}
      />
      <span>{props.children}</span>
    </li>
  );
}
