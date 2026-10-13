// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { LocalizerType } from '../../types/Util.std.ts';
import { getStringForConversationMerge } from '../../util/getStringForConversationMerge.std.ts';
import { Emojify } from './Emojify.dom.tsx';
import { I18n } from '../I18n.dom.tsx';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { AxoChatEvent } from '../../axo/chat/AxoChatEvent.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';

export type PropsDataType = {
  conversationTitle: string;
  obsoleteConversationTitle: string | undefined;
  obsoleteConversationNumber: string | undefined;
};
export type PropsType = PropsDataType & {
  i18n: LocalizerType;
};

export function ConversationMergeNotification(props: PropsType): ReactNode {
  const {
    conversationTitle,
    obsoleteConversationTitle,
    obsoleteConversationNumber,
    i18n,
  } = props;
  const message = getStringForConversationMerge({
    conversationTitle,
    obsoleteConversationTitle,
    obsoleteConversationNumber,
    i18n,
  });

  return (
    <AxoChatEvent.Root variant="secondary">
      <AxoChatEvent.Body symbol="merge">
        <Emojify text={message} />
      </AxoChatEvent.Body>
      {obsoleteConversationTitle != null && (
        <ConversationMergeNotificationDialog
          i18n={i18n}
          conversationTitle={conversationTitle}
          obsoleteConversationTitle={obsoleteConversationTitle}
        >
          <AxoChatEvent.Action>
            {i18n('icu:ConversationMerge--learn-more')}
          </AxoChatEvent.Action>
        </ConversationMergeNotificationDialog>
      )}
    </AxoChatEvent.Root>
  );
}

type ConversationMergeNotificationDialogProps = Readonly<{
  i18n: LocalizerType;
  children: ReactNode;
  conversationTitle: string;
  obsoleteConversationTitle: string;
}>;

function ConversationMergeNotificationDialog(
  props: ConversationMergeNotificationDialogProps
): ReactNode {
  const { i18n } = props;

  return (
    <AxoDialog.Root>
      <AxoDialog.Trigger asChild>{props.children}</AxoDialog.Trigger>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header floating>
          <AxoDialog.Title>
            {i18n('icu:ConversationMerge--explainer-dialog--label')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('mb-4 flex justify-center')}>
            <img
              role="none"
              src="images/merged-chat.svg"
              alt=""
              width={44}
              height={88}
            />
          </div>

          <AxoDialog.Description>
            <p className={tw('mb-2')}>
              <I18n
                i18n={i18n}
                id="icu:ConversationMerge--explainer-dialog--line-1"
                components={{
                  conversationTitle: props.conversationTitle,
                  obsoleteConversationTitle: props.obsoleteConversationTitle,
                }}
              />
            </p>
            <p>{i18n('icu:ConversationMerge--explainer-dialog--line-2')}</p>
          </AxoDialog.Description>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
