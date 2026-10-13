// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useState, type ReactNode } from 'react';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import { I18n } from '../I18n.dom.tsx';
import { Emojify } from './Emojify.dom.tsx';
import type { LocalizerType } from '../../types/Util.std.ts';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.ts';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';

export type DeliveryIssueDialogProps = Readonly<{
  i18n: LocalizerType;
  sender: ConversationType;
  inGroup: boolean;
  children: ReactNode;
}>;

export function DeliveryIssueDialog(
  props: DeliveryIssueDialogProps
): ReactNode {
  const { i18n, inGroup, sender } = props;
  const [open, setOpen] = useState(false);

  const handleOpenSupportUrl = useCallback(() => {
    openLinkInWebBrowser(
      'https://support.signal.org/hc/articles/4404859745690'
    );
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const senderTitle = <Emojify text={sender.title} />;

  return (
    <AxoDialog.Root open={open} onOpenChange={setOpen}>
      <AxoDialog.Trigger asChild>{props.children}</AxoDialog.Trigger>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Body>
          <div className={tw('flex justify-center')}>
            <img
              src="images/delivery-issue.svg"
              height="110"
              width="200"
              alt=""
            />
          </div>
          <AxoDialog.Title>{i18n('icu:DeliveryIssue--title')}</AxoDialog.Title>
          <AxoDialog.Description>
            <div className={tw('text-center type-body-medium')}>
              {inGroup ? (
                <I18n
                  id="icu:DeliveryIssue--summary--group"
                  components={{ sender: senderTitle }}
                  i18n={i18n}
                />
              ) : (
                <I18n
                  id="icu:DeliveryIssue--summary"
                  components={{ sender: senderTitle }}
                  i18n={i18n}
                />
              )}
            </div>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="subtle-secondary"
              arrow="external-link"
              onClick={handleOpenSupportUrl}
            >
              {i18n('icu:DeliveryIssue--learnMore')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="subtle-primary"
              onClick={handleClose}
              autoFocus
            >
              {i18n('icu:Confirmation--confirm')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
