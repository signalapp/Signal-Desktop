// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import {
  useCallback,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { LocalizerType } from '../../types/Util.std.ts';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.ts';

export type ChatSessionRefreshedDialogProps = Readonly<{
  i18n: LocalizerType;
  children: ReactNode;
}>;

export function ChatSessionRefreshedDialog(
  props: ChatSessionRefreshedDialogProps
): ReactElement {
  const { i18n } = props;
  const [open, setOpen] = useState(false);

  const handleOpenSupportUrl = useCallback(() => {
    openLinkInWebBrowser(
      'https://support.signal.org/hc/requests/new?desktop&chat_refreshed'
    );
    setOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <AxoDialog.Root open={open} onOpenChange={setOpen}>
      <AxoDialog.Trigger asChild>{props.children}</AxoDialog.Trigger>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header floating>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('mb-2.5 flex justify-center')}>
            <img
              src="images/chat-session-refresh.svg"
              height="110"
              width="200"
              alt=""
            />
          </div>

          <AxoDialog.Title>
            <span className={tw('type-title-medium')}>
              {i18n('icu:ChatRefresh--notification')}
            </span>
          </AxoDialog.Title>
          <AxoDialog.Description>
            <p>{i18n('icu:ChatRefresh--summary')}</p>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              onClick={handleOpenSupportUrl}
              variant="subtle-secondary"
              arrow="external-link"
            >
              {i18n('icu:ChatRefresh--contactSupport')}
            </AxoDialog.Action>
            <AxoDialog.Action
              onClick={handleClose}
              autoFocus
              variant="strong-primary"
            >
              {i18n('icu:ok')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
