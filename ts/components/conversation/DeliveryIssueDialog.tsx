// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { ConversationType } from '../../state/ducks/conversations';
import { Modal } from '../Modal';
import { Intl } from '../Intl';
import { Emojify } from './Emojify';

import { LocalizerType } from '../../types/Util';

export type PropsType = {
  i18n: LocalizerType;
  sender: ConversationType;
  onClose: () => unknown;
};

export function DeliveryIssueDialog(props: PropsType): React.ReactElement {
  const { i18n, sender, onClose } = props;

  return (
    <Modal hasXButton={false} i18n={i18n}>
      <div className="module-delivery-issue-dialog">
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
            id="DeliveryIssue--summary"
            components={{
              sender: <Emojify text={sender.title} />,
            }}
            i18n={i18n}
          />
        </div>
        <div className="module-delivery-issue-dialog__buttons">
          <button
            type="button"
            onClick={onClose}
            className="module-delivery-issue-dialog__button"
          >
            {i18n('Confirmation--confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
