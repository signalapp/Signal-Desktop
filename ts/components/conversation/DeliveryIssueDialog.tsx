// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { Button, ButtonSize, ButtonVariant } from '../Button.dom.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import { Modal } from '../Modal.dom.js';
import { I18n } from '../I18n.dom.js';
import { Emojify } from './Emojify.dom.js';

import { useRestoreFocus } from '../../hooks/useRestoreFocus.dom.js';

import type { LocalizerType } from '../../types/Util.std.js';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.js';

export type PropsType = {
  i18n: LocalizerType;
  sender: ConversationType;
  inGroup: boolean;
  onClose: () => unknown;
};

export function DeliveryIssueDialog(props: PropsType): React.ReactElement {
  const { i18n, inGroup, sender, onClose } = props;

  // Focus first button after initial render, restore focus on teardown
  const [focusRef] = useRestoreFocus();

  const footer = (
    <>
      <Button
        onClick={() =>
          openLinkInWebBrowser(
            'https://support.signal.org/hc/articles/4404859745690'
          )
        }
        size={ButtonSize.Medium}
        variant={ButtonVariant.Secondary}
      >
        {i18n('icu:DeliveryIssue--learnMore')}
      </Button>
      <Button
        onClick={onClose}
        ref={focusRef}
        size={ButtonSize.Medium}
        variant={ButtonVariant.Primary}
        className="module-delivery-issue-dialog__close-button"
      >
        {i18n('icu:Confirmation--confirm')}
      </Button>
    </>
  );

  const senderTitle = <Emojify text={sender.title} />;

  return (
    <Modal
      modalName="DeliveryIssueDialog"
      hasXButton={false}
      onClose={onClose}
      i18n={i18n}
      modalFooter={footer}
    >
      <section>
        <div className="module-delivery-issue-dialog__image">
          <img
            src="images/delivery-issue.svg"
            height="110"
            width="200"
            alt=""
          />
        </div>
        <div className="module-delivery-issue-dialog__title">
          {i18n('icu:DeliveryIssue--title')}
        </div>
        <div className="module-delivery-issue-dialog__description">
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
      </section>
    </Modal>
  );
}
