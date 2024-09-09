// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ReadonlyMessageAttributesType,
  MessageAttributesType,
} from '../../../model-types.d';
import { find } from '../../../util/iterables';
import { DataReader } from '../../../sql/Client';

export type CircularMessageCacheOptionsType = Readonly<{
  size: number;
  flush: () => Promise<void>;
}>;

export class CircularMessageCache {
  private readonly flush: () => Promise<void>;
  private readonly buffer: Array<MessageAttributesType | undefined>;
  private readonly sentAtToMessages = new Map<
    number,
    Set<MessageAttributesType>
  >();
  private offset = 0;

  constructor({ size, flush }: CircularMessageCacheOptionsType) {
    this.flush = flush;
    this.buffer = new Array(size);
  }

  public push(attributes: MessageAttributesType): void {
    const stale = this.buffer[this.offset];
    this.buffer[this.offset] = attributes;
    this.offset = (this.offset + 1) % this.buffer.length;

    let addedSet = this.sentAtToMessages.get(attributes.sent_at);
    if (addedSet === undefined) {
      addedSet = new Set();
      this.sentAtToMessages.set(attributes.sent_at, addedSet);
    }
    addedSet.add(attributes);

    if (stale === undefined) {
      return;
    }

    const staleSet = this.sentAtToMessages.get(stale.sent_at);
    if (staleSet === undefined) {
      return;
    }
    staleSet.delete(stale);
    if (staleSet.size === 0) {
      this.sentAtToMessages.delete(stale.sent_at);
    }
  }

  public async findBySentAt(
    sentAt: number,
    predicate: (attributes: ReadonlyMessageAttributesType) => boolean
  ): Promise<MessageAttributesType | undefined> {
    const set = this.sentAtToMessages.get(sentAt);
    if (set !== undefined) {
      const cached = find(set.values(), predicate);
      if (cached != null) {
        return cached;
      }
    }

    await this.flush();

    const onDisk = await DataReader.getMessagesBySentAt(sentAt);
    return onDisk.find(predicate);
  }

  // Just a stub to conform with the interface
  public async upgradeSchema(
    attributes: MessageAttributesType
  ): Promise<MessageAttributesType> {
    return attributes;
  }
}
