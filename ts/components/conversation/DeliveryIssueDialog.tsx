// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { Button, ButtonSize, ButtonVariant } from '../Button';
import type { ConversationType } from '../../state/ducks/conversations';
import { Modal } from '../Modal';
import { Intl } from '../Intl';
import { Emojify } from './Emojify';

import { useRestoreFocus } from '../../hooks/useRestoreFocus';

import type { LocalizerType } from '../../types/Util';

export type PropsType = {
  i18n: LocalizerType;
  sender: ConversationType;
  inGroup: boolean;
  learnMoreAboutDeliveryIssue: () => unknown;
  onClose: () => unknown;
};

export function DeliveryIssueDialog(props: PropsType): React.ReactElement {
  const { i18n, inGroup, learnMoreAboutDeliveryIssue, sender, onClose } = props;

  const key = inGroup
    ? 'DeliveryIssue--summary--group'
    : 'DeliveryIssue--summary';

  // Focus first button after initial render, restore focus on teardown
  const [focusRef] = useRestoreFocus();

  return (
    <Modal hasXButton={false} onClose={onClose} i18n={i18n}>
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
          {i18n('DeliveryIssue--title')}
        </div>
        <div className="module-delivery-issue-dialog__description">
          <Intl
            id={key}
            components={{
              sender: <Emojify text={sender.title} />,
            }}
            i18n={i18n}
          />
        </div>
      </section>
      <Modal.ButtonFooter>
        <Button
          onClick={learnMoreAboutDeliveryIssue}
          size={ButtonSize.Medium}
          variant={ButtonVariant.Secondary}
        >
          {i18n('DeliveryIssue--learnMore')}
        </Button>
        <Button
          onClick={onClose}
          ref={focusRef}
          size={ButtonSize.Medium}
          variant={ButtonVariant.Primary}
          className="module-delivery-issue-dialog__close-button"
        >
          {i18n('Confirmation--confirm')}
        </Button>
      </Modal.ButtonFooter>
    </Modal>
  );
}
