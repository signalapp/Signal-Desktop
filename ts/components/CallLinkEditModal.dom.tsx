// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import { useMemo } from 'react';
import type { LocalizerType } from '../types/I18N.std.ts';
import {
  CallLinkRestrictions,
  type CallLinkType,
} from '../types/CallLink.std.ts';
import { linkCallRoute } from '../util/signalRoutes.std.ts';
import { getColorForCallLink } from '../util/getColorForCallLink.std.ts';
import { InAnotherCallTooltip } from './conversation/InAnotherCallTooltip.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import { AxoList } from '../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../axo/items/AxoItem.dom.tsx';
import { AxoClickableItem } from '../axo/items/AxoClickableItem.dom.tsx';
import { AxoSwitchItem } from '../axo/items/AxoSwitchItem.dom.tsx';

export type CallLinkEditModalProps = {
  i18n: LocalizerType;
  callLink: CallLinkType;
  hasActiveCall: boolean;
  onClose: () => void;
  onCopyCallLink: () => void;
  onOpenCallLinkAddNameModal: () => void;
  onUpdateCallLinkRestrictions: (restrictions: CallLinkRestrictions) => void;
  onShareCallLinkViaSignal: () => void;
  onStartCallLinkLobby: () => void;
};

export function CallLinkEditModal({
  i18n,
  callLink,
  hasActiveCall,
  onClose,
  onCopyCallLink,
  onOpenCallLinkAddNameModal,
  onUpdateCallLinkRestrictions,
  onShareCallLinkViaSignal,
  onStartCallLinkLobby,
}: CallLinkEditModalProps): JSX.Element {
  const callLinkWebUrl = useMemo(() => {
    return linkCallRoute.toWebUrl({ key: callLink.rootKey }).toString();
  }, [callLink.rootKey]);

  return (
    <AxoDialog.Root open onOpenChange={onClose}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:CallLinkEditModal__Title')}
          </AxoDialog.Title>
        </AxoDialog.Header>
        <AxoDialog.Body padding="md">
          <AxoList.Group>
            <AxoList.Root>
              <AxoList.Body>
                <AxoItem.Group spacing="sm">
                  <AxoItem.Root>
                    <AxoItem.Leading centerToFullHeight>
                      <AxoItem.IconAvatar
                        symbol="videocamera"
                        size={48}
                        color={getColorForCallLink(callLink.rootKey)}
                      />
                    </AxoItem.Leading>
                    <AxoItem.Content>
                      <AxoItem.Label>
                        <span className={tw('font-semibold')}>
                          {callLink.name === ''
                            ? i18n('icu:calling__call-link-default-title')
                            : callLink.name}
                        </span>
                      </AxoItem.Label>
                      <AxoItem.Description>
                        <button
                          type="button"
                          onClick={onCopyCallLink}
                          aria-label={i18n('icu:CallLinkDetails__CopyLink')}
                          className={tw(
                            'text-start',
                            'rounded-xs',
                            'focus-visible:axo-focus-ring focus-visible:outline-none'
                          )}
                        >
                          <div className={tw('line-clamp-2 break-all')}>
                            {callLinkWebUrl}
                          </div>
                        </button>
                      </AxoItem.Description>
                      <AxoItem.Accessory centerToFullHeight>
                        <InAnotherCallTooltip
                          inAnotherCall={hasActiveCall}
                          i18n={i18n}
                        >
                          <AxoButton.Root
                            onClick={onStartCallLinkLobby}
                            size="md"
                            variant="subtle-affirmative"
                            discouraged={hasActiveCall}
                          >
                            {i18n('icu:CallLinkEditModal__JoinButtonLabel')}
                          </AxoButton.Root>
                        </InAnotherCallTooltip>
                      </AxoItem.Accessory>
                    </AxoItem.Content>
                  </AxoItem.Root>
                </AxoItem.Group>
              </AxoList.Body>
            </AxoList.Root>
            <AxoList.Root>
              <AxoList.Body>
                <AxoItem.Group>
                  <AxoClickableItem.Root
                    symbol="pencil"
                    label={
                      callLink.name === ''
                        ? i18n('icu:CallLinkEditModal__AddCallNameLabel')
                        : i18n('icu:CallLinkEditModal__EditCallNameLabel')
                    }
                    onClick={onOpenCallLinkAddNameModal}
                  />
                  <AxoSwitchItem.Root
                    symbol="person-check"
                    label={i18n(
                      'icu:CallLinkEditModal__InputLabel--ApproveAllMembers'
                    )}
                    checked={
                      callLink.restrictions !== CallLinkRestrictions.None
                    }
                    onCheckedChange={checked => {
                      onUpdateCallLinkRestrictions(
                        checked
                          ? CallLinkRestrictions.AdminApproval
                          : CallLinkRestrictions.None
                      );
                    }}
                  />
                </AxoItem.Group>
              </AxoList.Body>
            </AxoList.Root>
            <AxoList.Root>
              <AxoList.Body>
                <AxoItem.Group>
                  <AxoClickableItem.Root
                    symbol="copy"
                    label={i18n('icu:CallLinkDetails__CopyLink')}
                    onClick={onCopyCallLink}
                  />
                  <AxoClickableItem.Root
                    symbol="share"
                    label={i18n('icu:CallLinkDetails__ShareLinkViaSignal')}
                    onClick={onShareCallLinkViaSignal}
                  />
                </AxoItem.Group>
              </AxoList.Body>
            </AxoList.Root>
          </AxoList.Group>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="strong-primary" onClick={onClose}>
              {i18n('icu:done')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
