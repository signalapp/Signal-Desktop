// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, MouseEvent, ReactNode } from 'react';

import type { ReadonlyDeep } from 'type-fest';

import { getDisplayName } from '../../types/EmbeddedContact.std.ts';
import { getInitials } from '../../util/getInitials.std.ts';
import { useAttachmentStatus } from '../../hooks/useAttachmentStatus.std.ts';
import { AxoAvatar } from '../../axo/AxoAvatar.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import type { AxoTokens } from '../../axo/AxoTokens.std.ts';
import { AxoProgressIndicator } from '../../axo/status/AxoProgressIndicator.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';

import type { EmbeddedContactForUIType } from '../../types/EmbeddedContact.std.ts';

const AVATAR_COLOR: AxoTokens.Avatar.ColorName = 'A100';

export function ContactAvatar({
  contact,
  isIncoming,
  label,
  onClick,
  size,
}: {
  contact: ReadonlyDeep<EmbeddedContactForUIType>;
  isIncoming: boolean;
  label: string | null;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  size: 52 | 80;
}): JSX.Element {
  const attachment = contact.avatar?.avatar;
  const status = useAttachmentStatus(attachment);
  const initials = getInitials(getDisplayName(contact));

  let content: ReactNode;
  if (status != null && status.state !== 'ReadyToShow') {
    content = (
      <span
        className={tw(
          'relative flex size-full items-center justify-center rounded-full',
          isIncoming
            ? 'bg-onmessage-incoming-primary text-primary'
            : 'bg-onmessage-outgoing-primary text-primary-oncolor'
        )}
      >
        <AxoSymbol.Icon
          symbol={status.state === 'Downloading' ? 'x' : 'arrow-down'}
          size={24}
          label={null}
        />
        {status.state === 'Downloading' && (
          <span
            className={tw('absolute inset-0 flex items-center justify-center')}
          >
            <AxoProgressIndicator.Root
              size="lg"
              completed={status.totalDownloaded ?? 'indeterminate'}
              total={status.size > 0 ? status.size : 'indeterminate'}
              noTrack
            />
          </span>
        )}
      </span>
    );
  } else if (attachment?.url) {
    content = (
      <AxoAvatar.Image
        src={attachment.url}
        srcWidth={attachment.width ?? size}
        srcHeight={attachment.height ?? size}
        blur={false}
        fallbackIcon="person"
        fallbackColor={AVATAR_COLOR}
      />
    );
  } else if (initials) {
    content = <AxoAvatar.Initials initials={initials} color={AVATAR_COLOR} />;
  } else {
    content = <AxoAvatar.Icon symbol="person" />;
  }

  return (
    <AxoAvatar.Root size={size}>
      <AxoAvatar.Content label={label} onClick={onClick}>
        {content}
      </AxoAvatar.Content>
    </AxoAvatar.Root>
  );
}
