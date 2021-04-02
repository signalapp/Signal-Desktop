// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable more/no-then */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */

import EventTarget from './EventTarget';
import MessageReceiver from './MessageReceiver';
import MessageSender from './SendMessage';

class SyncRequestInner extends EventTarget {
  receiver: MessageReceiver;

  contactSync?: boolean;

  groupSync?: boolean;

  timeout: any;

  oncontact: Function;

  ongroup: Function;

  constructor(sender: MessageSender, receiver: MessageReceiver) {
    super();

    if (
      !(sender instanceof MessageSender) ||
      !(receiver instanceof MessageReceiver)
    ) {
      throw new Error(
        'Tried to construct a SyncRequest without MessageSender and MessageReceiver'
      );
    }
    this.receiver = receiver;

    this.oncontact = this.onContactSyncComplete.bind(this);
    receiver.addEventListener('contactsync', this.oncontact);

    this.ongroup = this.onGroupSyncComplete.bind(this);
    receiver.addEventListener('groupsync', this.ongroup);

    const ourNumber = window.textsecure.storage.user.getNumber();
    const { wrap, sendOptions } = window.ConversationController.prepareForSend(
      ourNumber,
      {
        syncMessage: true,
      }
    );

    window.log.info('SyncRequest created. Sending config sync request...');
    wrap(sender.sendRequestConfigurationSyncMessage(sendOptions));

    window.log.info('SyncRequest now sending block sync request...');
    wrap(sender.sendRequestBlockSyncMessage(sendOptions));

    window.log.info('SyncRequest now sending contact sync message...');
    wrap(sender.sendRequestContactSyncMessage(sendOptions))
      .then(() => {
        window.log.info('SyncRequest now sending group sync message...');
        return wrap(sender.sendRequestGroupSyncMessage(sendOptions));
      })
      .catch((error: Error) => {
        window.log.error(
          'SyncRequest error:',
          error && error.stack ? error.stack : error
        );
      });
    this.timeout = setTimeout(this.onTimeout.bind(this), 60000);
  }

  onContactSyncComplete() {
    this.contactSync = true;
    this.update();
  }

  onGroupSyncComplete() {
    this.groupSync = true;
    this.update();
  }

  update() {
    if (this.contactSync && this.groupSync) {
      this.dispatchEvent(new Event('success'));
      this.cleanup();
    }
  }

  onTimeout() {
    if (this.contactSync || this.groupSync) {
      this.dispatchEvent(new Event('success'));
    } else {
      this.dispatchEvent(new Event('timeout'));
    }
    this.cleanup();
  }

  cleanup() {
    clearTimeout(this.timeout);
    this.receiver.removeEventListener('contactsync', this.oncontact);
    this.receiver.removeEventListener('groupSync', this.ongroup);
    delete this.listeners;
  }
}

export default class SyncRequest {
  constructor(sender: MessageSender, receiver: MessageReceiver) {
    const inner = new SyncRequestInner(sender, receiver);
    this.addEventListener = inner.addEventListener.bind(inner);
    this.removeEventListener = inner.removeEventListener.bind(inner);
  }

  addEventListener: (name: string, handler: Function) => void;

  removeEventListener: (name: string, handler: Function) => void;
}
