// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import type { CallbackResultType } from '../textsecure/Types.d';
import * as log from '../logging/log';

type StringKey<T> = keyof T & string;

export class MessageModel {
  public get id(): string {
    return this.#_attributes.id;
  }

  public get<keyName extends StringKey<MessageAttributesType>>(
    key: keyName
  ): MessageAttributesType[keyName] {
    return this.attributes[key];
  }
  public set(
    attributes: Partial<MessageAttributesType>,
    { noTrigger }: { noTrigger?: boolean } = {}
  ): void {
    this.#_attributes = {
      ...this.attributes,
      ...attributes,
    };

    if (noTrigger) {
      return;
    }

    window.MessageCache._updateCaches(this);
  }

  public get attributes(): Readonly<MessageAttributesType> {
    return this.#_attributes;
  }
  #_attributes: MessageAttributesType;

  constructor(attributes: MessageAttributesType) {
    this.#_attributes = attributes;

    this.set(
      window.Signal.Types.Message.initializeSchemaVersion({
        message: attributes,
        logger: log,
      }),
      { noTrigger: true }
    );
  }

  // --- Other housekeeping:

  // Set when sending some sync messages, so we get the functionality of
  //   send(), without zombie messages going into the database.
  doNotSave?: boolean;
  // Set when sending stories, so we get the functionality of send() but we are
  //   able to send the sync message elsewhere.
  doNotSendSyncMessage?: boolean;

  deletingForEveryone?: boolean;

  pendingMarkRead?: number;

  syncPromise?: Promise<CallbackResultType | void>;
}
