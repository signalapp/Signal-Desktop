// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { Collection, Model } from 'backbone';
import type { MessageModel } from '../models/messages';
import { getContactId } from '../messages/helpers';
import * as log from '../logging/log';
import { deleteForEveryone } from '../util/deleteForEveryone';

export type DeleteAttributesType = {
  targetSentTimestamp: number;
  serverTimestamp: number;
  fromId: string;
};

export class DeleteModel extends Model<DeleteAttributesType> {}

let singleton: Deletes | undefined;

export class Deletes extends Collection<DeleteModel> {
  static getSingleton(): Deletes {
    if (!singleton) {
      singleton = new Deletes();
    }

    return singleton;
  }

  forMessage(message: MessageModel): Array<DeleteModel> {
    const matchingDeletes = this.filter(item => {
      return (
        item.get('targetSentTimestamp') === message.get('sent_at') &&
        item.get('fromId') === getContactId(message.attributes)
      );
    });

    if (matchingDeletes.length > 0) {
      log.info('Found early DOE for message');
      this.remove(matchingDeletes);
      return matchingDeletes;
    }

    return [];
  }

  async onDelete(del: DeleteModel): Promise<void> {
    try {
      // The conversation the deleted message was in; we have to find it in the database
      //   to to figure that out.
      const targetConversation =
        await window.ConversationController.getConversationForTargetMessage(
          del.get('fromId'),
          del.get('targetSentTimestamp')
        );

      if (!targetConversation) {
        log.info(
          'No target conversation for DOE',
          del.get('fromId'),
          del.get('targetSentTimestamp')
        );

        return;
      }

      // Do not await, since this can deadlock the queue
      targetConversation.queueJob('Deletes.onDelete', async () => {
        log.info('Handling DOE for', del.get('targetSentTimestamp'));

        const messages = await window.Signal.Data.getMessagesBySentAt(
          del.get('targetSentTimestamp')
        );

        const targetMessage = messages.find(
          m => del.get('fromId') === getContactId(m) && !m.deletedForEveryone
        );

        if (!targetMessage) {
          log.info(
            'No message for DOE',
            del.get('fromId'),
            del.get('targetSentTimestamp')
          );

          return;
        }

        const message = window.MessageController.register(
          targetMessage.id,
          targetMessage
        );

        await deleteForEveryone(message, del);

        this.remove(del);
      });
    } catch (error) {
      log.error(
        'Deletes.onDelete error:',
        error && error.stack ? error.stack : error
      );
    }
  }
}
