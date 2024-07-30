// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../types/Util';
import { getStringForConversationMerge } from '../../util/getStringForConversationMerge';
import { Button, ButtonSize, ButtonVariant } from '../Button';
import { SystemMessage } from './SystemMessage';
import { Emojify } from './Emojify';
import { Modal } from '../Modal';
import { I18n } from '../I18n';

export type PropsDataType = {
  conversationTitle: string;
  obsoleteConversationTitle: string | undefined;
  obsoleteConversationNumber: string | undefined;
};
export type PropsType = PropsDataType & {
  i18n: LocalizerType;
};

export function ConversationMergeNotification(props: PropsType): JSX.Element {
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

  const [showingDialog, setShowingDialog] = React.useState(false);

  const showDialog = React.useCallback(() => {
    setShowingDialog(true);
  }, [setShowingDialog]);

  const dismissDialog = React.useCallback(() => {
    setShowingDialog(false);
  }, [setShowingDialog]);

  return (
    <>
      <SystemMessage
        icon="merge"
        contents={<Emojify text={message} />}
        button={
          obsoleteConversationTitle ? (
            <Button
              onClick={showDialog}
              size={ButtonSize.Small}
              variant={ButtonVariant.SystemMessage}
            >
              {i18n('icu:ConversationMerge--learn-more')}
            </Button>
          ) : undefined
        }
      />
      {showingDialog && obsoleteConversationTitle ? (
        <Modal
          hasXButton
          modalName="ConversationMergeExplainer"
          onClose={dismissDialog}
          i18n={i18n}
        >
          <div className="module-conversation-merge-notification__dialog__image">
            <img src="images/merged-chat.svg" alt="" />
            <div className="module-conversation-merge-notification__dialog__text-1">
              <I18n
                i18n={i18n}
                id="icu:ConversationMerge--explainer-dialog--line-1"
                components={{
                  conversationTitle,
                  obsoleteConversationTitle,
                }}
              />
            </div>
            <div className="module-conversation-merge-notification__dialog__text-2">
              <I18n
                i18n={i18n}
                id="icu:ConversationMerge--explainer-dialog--line-2"
              />
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
