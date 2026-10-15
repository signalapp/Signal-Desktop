// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, MouseEvent } from 'react';

import type { ReadonlyDeep } from 'type-fest';

import { getDisplayName } from '../../types/EmbeddedContact.std.ts';
import type { EmbeddedContactForUIType } from '../../types/EmbeddedContact.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { ContactAvatar } from './contactUtil.dom.tsx';

export type Props = {
  contact: ReadonlyDeep<EmbeddedContactForUIType>;
  i18n: LocalizerType;
  isIncoming: boolean;
  onClick: () => void;
  onSendMessage: (() => void) | undefined;
};

export function EmbeddedContact({
  contact,
  i18n,
  isIncoming,
  onClick,
  onSendMessage,
}: Props): JSX.Element {
  return (
    <div className={tw('flex flex-col gap-3 pt-1 pb-1.5')}>
      <button
        type="button"
        className={tw(
          'flex w-full min-w-0 items-center gap-3 rounded-lg text-start',
          'focus-visible:axo-focus-ring'
        )}
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();
          onClick();
        }}
      >
        <ContactAvatar
          contact={contact}
          isIncoming={isIncoming}
          label={null}
          size={52}
        />
        <span
          className={tw(
            'min-w-0 grow truncate type-body-large font-medium',
            isIncoming ? 'text-primary' : 'text-primary-oncolor'
          )}
        >
          {getDisplayName(contact)}
        </span>
        <span
          className={tw(
            'shrink-0',
            isIncoming ? 'text-secondary' : 'text-secondary-oncolor'
          )}
        >
          <AxoSymbol.Icon symbol="chevron-[end]" size={20} label={null} />
        </span>
      </button>
      {onSendMessage != null && (
        <AxoButton.Root
          variant={
            isIncoming ? 'message-incoming-primary' : 'message-outgoing-primary'
          }
          size="lg"
          width="full"
          onClick={event => {
            event.stopPropagation();
            event.preventDefault();
            onSendMessage();
          }}
        >
          {i18n('icu:EmbeddedContact__message')}
        </AxoButton.Root>
      )}
    </div>
  );
}
