// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type JSX, type ReactNode } from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { type AxoSymbolIconName } from '../axo/_internal/AxoSymbolDefs.generated.std.ts';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';
import { I18n } from './I18n.dom.tsx';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';

const LEARN_MORE_LINK =
  'https://support.signal.org/hc/articles/360007320551-Linked-Devices';

export function MaybeTransferModal({
  i18n,
  onCancel,
  onDontTransfer,
  onTransfer,
  open,
}: {
  i18n: LocalizerType;
  onCancel: () => void;
  onDontTransfer: () => void;
  onTransfer: () => void;
  open: boolean;
}): JSX.Element {
  return (
    <AxoDialog.Root
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <AxoDialog.Content
        size="sm"
        escape="cancel-is-noop"
        disableMissingAriaDescriptionWarning
      >
        <AxoDialog.Body maxHeight={600}>
          <div className={tw('mt-8 flex flex-col items-center')}>
            <img
              src="images/desktop-and-phone.svg"
              height="80"
              width="100"
              alt=""
            />
            <AxoDialog.Title screenReaderOnly>
              {i18n('icu:MaybeTransferModal__title')}
            </AxoDialog.Title>
            <div className={tw('mt-4 text-center type-title-medium')}>
              {i18n('icu:MaybeTransferModal__title')}
            </div>
          </div>
          <div
            className={tw('mt-3 mb-5 flex flex-col gap-5 text-label-secondary')}
          >
            <div className={tw('text-center')}>
              <div>{i18n('icu:MaybeTransferModal__description')}</div>
              <a
                className={tw('text-label-primary')}
                href={LEARN_MORE_LINK}
                rel="noreferrer"
                target="_blank"
              >
                {i18n('icu:MaybeTransferModal__learnMore')}
              </a>
            </div>
            <ul className={tw('flex flex-col gap-5 px-4')}>
              <ListItemWithIcon
                iconName="message-thread"
                content={
                  <I18n
                    i18n={i18n}
                    id="icu:MaybeTransferModal__replaceHistory"
                    components={{ bold: Bold }}
                  />
                }
              />
              <ListItemWithIcon
                iconName="qrcode"
                content={i18n('icu:MaybeTransferModal__scanQrCode')}
              />
              <ListItemWithIcon
                iconName="backup"
                content={i18n('icu:MaybeTransferModal__media')}
              />
            </ul>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={onDontTransfer}>
              {i18n('icu:MaybeTransferModal__dontTransfer')}
            </AxoDialog.Action>
            <AxoDialog.Action variant="primary" onClick={onTransfer}>
              {i18n('icu:MaybeTransferModal__transfer')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function ListItemWithIcon({
  iconName,
  content,
}: {
  iconName: AxoSymbolIconName;
  content: ReactNode;
}): ReactNode {
  return (
    <li className={tw('flex gap-2')}>
      <div
        className={tw(
          'flex size-8 shrink-0 items-center justify-center rounded-full bg-fill-secondary'
        )}
      >
        <AxoSymbol.Icon size={20} symbol={iconName} label={null} />
      </div>
      <div>{content}</div>
    </li>
  );
}

function Bold(parts: Array<string | JSX.Element>) {
  return <strong>{parts}</strong>;
}

export function DeleteDataAndRelinkConfirmationDialog({
  i18n,
  onCancel,
  onConfirm,
  open,
}: {
  i18n: LocalizerType;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}): JSX.Element {
  return (
    <AxoAlertDialog.Root
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>
            {i18n('icu:DeleteDataAndRelinkConfirmationDialog__title')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n('icu:DeleteDataAndRelinkConfirmationDialog__body')}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Action variant="secondary" onClick={onCancel}>
            {i18n('icu:cancel')}
          </AxoAlertDialog.Action>
          <AxoButton.Root
            variant="destructive"
            size="md"
            width="grow"
            onClick={onConfirm}
          >
            {i18n('icu:delete')}
          </AxoButton.Root>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
