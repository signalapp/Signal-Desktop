// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Long from 'long';

import {
  processDataMessage,
  ATTACHMENT_MAX,
} from '../textsecure/processDataMessage';
import type { ProcessedAttachment } from '../textsecure/Types.d';
import { SignalService as Proto } from '../protobuf';
import { IMAGE_GIF } from '../types/MIME';

const FLAGS = Proto.DataMessage.Flags;

const TIMESTAMP = Date.now();

const UNPROCESSED_ATTACHMENT: Proto.IAttachmentPointer = {
  cdnId: Long.fromNumber(123),
  key: new Uint8Array([1, 2, 3]),
  digest: new Uint8Array([4, 5, 6]),
  contentType: IMAGE_GIF,
  size: 34,
};

const PROCESSED_ATTACHMENT: ProcessedAttachment = {
  cdnId: '123',
  key: 'AQID',
  digest: 'BAUG',
  contentType: IMAGE_GIF,
  size: 34,
};

const GROUP_ID = new Uint8Array([0x68, 0x65, 0x79]);

const DERIVED_GROUPV2_ID = '7qQUi8Wa6Jm3Rl+l63saATGeciEqokbHpP+lV3F5t9o=';

describe('processDataMessage', () => {
  const check = (message: Proto.IDataMessage) =>
    processDataMessage(
      {
        timestamp: Long.fromNumber(TIMESTAMP),
        ...message,
      },
      TIMESTAMP
    );

  it('should process attachments', async () => {
    const out = await check({
      attachments: [UNPROCESSED_ATTACHMENT],
    });

    assert.deepStrictEqual(out.attachments, [PROCESSED_ATTACHMENT]);
  });

  it('should process attachments with 0 cdnId', async () => {
    const out = await check({
      attachments: [
        {
          ...UNPROCESSED_ATTACHMENT,
          cdnId: new Long(0),
        },
      ],
    });

    assert.deepStrictEqual(out.attachments, [
      {
        ...PROCESSED_ATTACHMENT,
        cdnId: undefined,
      },
    ]);
  });

  it('should throw on too many attachments', async () => {
    const attachments: Array<Proto.IAttachmentPointer> = [];
    for (let i = 0; i < ATTACHMENT_MAX + 1; i += 1) {
      attachments.push(UNPROCESSED_ATTACHMENT);
    }

    await assert.isRejected(
      check({ attachments }),
      `Too many attachments: ${ATTACHMENT_MAX + 1} included in one message` +
        `, max is ${ATTACHMENT_MAX}`
    );
  });

  it('should process group context UPDATE/QUIT message', async () => {
    const { UPDATE, QUIT } = Proto.GroupContext.Type;

    for (const type of [UPDATE, QUIT]) {
      // eslint-disable-next-line no-await-in-loop
      const out = await check({
        body: 'should be deleted',
        attachments: [UNPROCESSED_ATTACHMENT],
        group: {
          id: GROUP_ID,
          name: 'Group',
          avatar: UNPROCESSED_ATTACHMENT,
          type,
          membersE164: ['+1'],
        },
      });

      assert.isUndefined(out.body);
      assert.strictEqual(out.attachments.length, 0);
      assert.deepStrictEqual(out.group, {
        id: 'hey',
        name: 'Group',
        avatar: PROCESSED_ATTACHMENT,
        type,
        membersE164: ['+1'],
        derivedGroupV2Id: DERIVED_GROUPV2_ID,
      });
    }
  });

  it('should process group context DELIVER message', async () => {
    const out = await check({
      body: 'should not be deleted',
      attachments: [UNPROCESSED_ATTACHMENT],
      group: {
        id: GROUP_ID,
        name: 'should be deleted',
        membersE164: ['should be deleted'],
        type: Proto.GroupContext.Type.DELIVER,
      },
    });

    assert.strictEqual(out.body, 'should not be deleted');
    assert.strictEqual(out.attachments.length, 1);
    assert.deepStrictEqual(out.group, {
      id: 'hey',
      type: Proto.GroupContext.Type.DELIVER,
      membersE164: [],
      derivedGroupV2Id: DERIVED_GROUPV2_ID,
      avatar: undefined,
      name: undefined,
    });
  });

  it('should process groupv2 context', async () => {
    const out = await check({
      groupV2: {
        masterKey: new Uint8Array(32),
        revision: 1,
        groupChange: new Uint8Array([4, 5, 6]),
      },
    });

    assert.deepStrictEqual(out.groupV2, {
      masterKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      revision: 1,
      groupChange: 'BAUG',
      id: 'd/rq8//fR4RzhvN3G9KcKlQoj7cguQFjTOqLV6JUSbo=',
      secretParams:
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAd/rq8//fR' +
        '4RzhvN3G9KcKlQoj7cguQFjTOqLV6JUSbrURzeILsUmsymGJmHt3kpBJ2zosqp4ex' +
        'sg+qwF1z6YdB/rxKnxKRLZZP/V0F7bERslYILy2lUh3Sh3iA98yO4CGfzjjFVo1SI' +
        '7U8XApLeVNQHJo7nkflf/JyBrqPft5gEucbKW/h+S3OYjfQ5zl2Cpw3XrV7N6OKEu' +
        'tLUWPHQuJx11A4xDPrmtAOnGy2NBxoOybDNlWipeNbn1WQJqOjMF7YA80oEm+5qnM' +
        'kEYcFVqbYaSzPcMhg3mQ0SYfQpxYgSOJpwp9f/8EDnwJV4ISPBOo2CiaSqVfnd8Dw' +
        'ZOc58gQA==',
      publicParams:
        'AHf66vP/30eEc4bzdxvSnCpUKI+3ILkBY0zqi1eiVEm6LnGylv4fk' +
        'tzmI30Oc5dgqcN161ezejihLrS1Fjx0LieOJpwp9f/8EDnwJV4ISPBOo2CiaSqVfn' +
        'd8DwZOc58gQA==',
    });
  });

  it('should base64 profileKey', async () => {
    const out = await check({
      profileKey: new Uint8Array([42, 23, 55]),
    });

    assert.strictEqual(out.profileKey, 'Khc3');
  });

  it('should process quote', async () => {
    const out = await check({
      quote: {
        id: Long.fromNumber(1),
        authorUuid: 'author',
        text: 'text',
        attachments: [
          {
            contentType: 'image/jpeg',
            fileName: 'image.jpg',
            thumbnail: UNPROCESSED_ATTACHMENT,
          },
        ],
      },
    });

    assert.deepStrictEqual(out.quote, {
      id: 1,
      authorUuid: 'author',
      text: 'text',
      attachments: [
        {
          contentType: 'image/jpeg',
          fileName: 'image.jpg',
          thumbnail: PROCESSED_ATTACHMENT,
        },
      ],
      bodyRanges: [],
      type: 0,
    });
  });

  it('should process contact', async () => {
    const out = await check({
      contact: [
        {
          avatar: {
            avatar: UNPROCESSED_ATTACHMENT,
          },
        },
        {
          avatar: {
            avatar: UNPROCESSED_ATTACHMENT,
            isProfile: true,
          },
        },
      ],
    });

    assert.deepStrictEqual(out.contact, [
      {
        avatar: { avatar: PROCESSED_ATTACHMENT, isProfile: false },
      },
      {
        avatar: { avatar: PROCESSED_ATTACHMENT, isProfile: true },
      },
    ]);
  });

  it('should process reaction', async () => {
    assert.deepStrictEqual(
      (
        await check({
          reaction: {
            emoji: '😎',
            targetTimestamp: Long.fromNumber(TIMESTAMP),
          },
        })
      ).reaction,
      {
        emoji: '😎',
        remove: false,
        targetAuthorUuid: undefined,
        targetTimestamp: TIMESTAMP,
      }
    );

    assert.deepStrictEqual(
      (
        await check({
          reaction: {
            emoji: '😎',
            remove: true,
            targetTimestamp: Long.fromNumber(TIMESTAMP),
          },
        })
      ).reaction,
      {
        emoji: '😎',
        remove: true,
        targetAuthorUuid: undefined,
        targetTimestamp: TIMESTAMP,
      }
    );
  });

  it('should process preview', async () => {
    const out = await check({
      preview: [
        {
          date: Long.fromNumber(TIMESTAMP),
          image: UNPROCESSED_ATTACHMENT,
        },
      ],
    });

    assert.deepStrictEqual(out.preview, [
      {
        date: TIMESTAMP,
        description: undefined,
        title: undefined,
        url: undefined,
        image: PROCESSED_ATTACHMENT,
      },
    ]);
  });

  it('should process sticker', async () => {
    const out = await check({
      sticker: {
        packId: new Uint8Array([1, 2, 3]),
        packKey: new Uint8Array([4, 5, 6]),
        stickerId: 1,
        emoji: '💯',
        data: UNPROCESSED_ATTACHMENT,
      },
    });

    assert.deepStrictEqual(out.sticker, {
      packId: '010203',
      packKey: 'BAUG',
      stickerId: 1,
      emoji: '💯',
      data: PROCESSED_ATTACHMENT,
    });
  });

  it('should process FLAGS=END_SESSION', async () => {
    const out = await check({
      flags: FLAGS.END_SESSION,
      body: 'should be deleted',
      group: {
        id: GROUP_ID,
        type: Proto.GroupContext.Type.DELIVER,
      },
      attachments: [UNPROCESSED_ATTACHMENT],
    });

    assert.isUndefined(out.body);
    assert.isUndefined(out.group);
    assert.deepStrictEqual(out.attachments, []);
  });

  it('should process FLAGS=EXPIRATION_TIMER_UPDATE,PROFILE_KEY_UPDATE', async () => {
    const values = [FLAGS.EXPIRATION_TIMER_UPDATE, FLAGS.PROFILE_KEY_UPDATE];
    for (const flags of values) {
      // eslint-disable-next-line no-await-in-loop
      const out = await check({
        flags,
        body: 'should be deleted',
        attachments: [UNPROCESSED_ATTACHMENT],
      });

      assert.isUndefined(out.body);
      assert.deepStrictEqual(out.attachments, []);
    }
  });

  it('processes trivial fields', async () => {
    assert.strictEqual((await check({ flags: null })).flags, 0);
    assert.strictEqual((await check({ flags: 1 })).flags, 1);

    assert.strictEqual((await check({ expireTimer: null })).expireTimer, 0);
    assert.strictEqual((await check({ expireTimer: 123 })).expireTimer, 123);

    assert.isFalse((await check({ isViewOnce: null })).isViewOnce);
    assert.isFalse((await check({ isViewOnce: false })).isViewOnce);
    assert.isTrue((await check({ isViewOnce: true })).isViewOnce);
  });
});
