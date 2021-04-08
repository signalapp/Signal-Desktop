// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable more/no-then */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */

import EventTarget from './EventTarget';
import MessageReceiver from './MessageReceiver';
import MessageSender from './SendMessage';
import { assert } from '../util/assert';

class SyncRequestInner extends EventTarget {
  private started = false;

  contactSync?: boolean;

  groupSync?: boolean;

  timeout: any;

  oncontact: Function;

  ongroup: Function;

  timeoutMillis: number;

  constructor(
    private sender: MessageSender,
    private receiver: MessageReceiver,
    timeoutMillis?: number
  ) {
    super();

    if (
      !(sender instanceof MessageSender) ||
      !(receiver instanceof MessageReceiver)
    ) {
      throw new Error(
        'Tried to construct a SyncRequest without MessageSender and MessageReceiver'
      );
    }

    this.oncontact = this.onContactSyncComplete.bind(this);
    receiver.addEventListener('contactsync', this.oncontact);

    this.ongroup = this.onGroupSyncComplete.bind(this);
    receiver.addEventListener('groupsync', this.ongroup);

    this.timeoutMillis = timeoutMillis || 60000;
  }

  async start(): Promise<void> {
    if (this.started) {
      assert(false, 'SyncRequestInner: started more than once. Doing nothing');
      return;
    }
    this.started = true;

    const { sender } = this;

    const ourNumber = window.textsecure.storage.user.getNumber();
    const {
      wrap,
      sendOptions,
    } = await window.ConversationController.prepareForSend(ourNumber, {
      syncMessage: true,
    });

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
    this.timeout = setTimeout(this.onTimeout.bind(this), this.timeoutMillis);
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
  private inner: SyncRequestInner;

  addEventListener: (name: string, handler: Function) => void;

  removeEventListener: (name: string, handler: Function) => void;

  constructor(
    sender: MessageSender,
    receiver: MessageReceiver,
    timeoutMillis?: number
  ) {
    const inner = new SyncRequestInner(sender, receiver, timeoutMillis);
    this.inner = inner;
    this.addEventListener = inner.addEventListener.bind(inner);
    this.removeEventListener = inner.removeEventListener.bind(inner);
  }

  start(): void {
    this.inner.start();
  }
}
