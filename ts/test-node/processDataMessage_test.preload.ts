// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import Long from 'long';
import { v4 as generateUuid } from 'uuid';

import {
  processDataMessage,
  ATTACHMENT_MAX,
} from '../textsecure/processDataMessage.preload.js';
import type { ProcessedAttachment } from '../textsecure/Types.d.ts';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { IMAGE_GIF, IMAGE_JPEG, LONG_MESSAGE } from '../types/MIME.std.js';
import { generateAci } from '../types/ServiceId.std.js';
import { toAciObject } from '../util/ServiceId.node.js';
import { uuidToBytes } from '../util/uuidToBytes.std.js';

const ACI_1 = generateAci();
const ACI_BINARY_1 = toAciObject(ACI_1).getRawUuidBytes();
const FLAGS = Proto.DataMessage.Flags;

const TIMESTAMP = Date.now();
const CLIENT_UUID = generateUuid();

const UNPROCESSED_ATTACHMENT: Proto.IAttachmentPointer = {
  cdnId: Long.fromNumber(123),
  cdnKey: 'cdnKey',
  cdnNumber: 2,
  blurHash: 'blurHash',
  caption: 'caption',
  clientUuid: uuidToBytes(CLIENT_UUID),
  key: new Uint8Array([1, 2, 3]),
  digest: new Uint8Array([4, 5, 6]),
  contentType: IMAGE_GIF,
  incrementalMac: new Uint8Array([12, 12, 12]),
  chunkSize: 24,
  uploadTimestamp: Long.fromNumber(456),
  size: 34,
  height: 64,
  width: 128,
  flags: 1,
  fileName: 'fileName',
};

const PROCESSED_ATTACHMENT: ProcessedAttachment = {
  cdnId: '123',
  cdnKey: 'cdnKey',
  cdnNumber: 2,
  blurHash: 'blurHash',
  caption: 'caption',
  clientUuid: CLIENT_UUID,
  key: 'AQID',
  digest: 'BAUG',
  contentType: IMAGE_GIF,
  incrementalMac: 'DAwM',
  chunkSize: 24,
  size: 34,
  uploadTimestamp: 456,
  height: 64,
  width: 128,
  flags: 1,
  fileName: 'fileName',
};

describe('processDataMessage', () => {
  const check = (message: Proto.IDataMessage) =>
    processDataMessage(
      {
        timestamp: Long.fromNumber(TIMESTAMP),
        ...message,
      },
      TIMESTAMP,
      {
        _createName: () => 'random-path',
      }
    );

  it('should process attachments', () => {
    const out = check({
      attachments: [UNPROCESSED_ATTACHMENT],
    });

    assert.deepStrictEqual(out.attachments, [
      {
        ...PROCESSED_ATTACHMENT,
        downloadPath: 'random-path',
      },
    ]);
  });

  it('should process attachments with 0 cdnId', () => {
    const out = check({
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
        downloadPath: 'random-path',
      },
    ]);
  });

  it('should move long text attachments to bodyAttachment', () => {
    const out = check({
      attachments: [
        UNPROCESSED_ATTACHMENT,
        {
          ...UNPROCESSED_ATTACHMENT,
          contentType: LONG_MESSAGE,
        },
      ],
    });

    assert.deepStrictEqual(out.attachments, [
      {
        ...PROCESSED_ATTACHMENT,
        downloadPath: 'random-path',
      },
    ]);
    assert.deepStrictEqual(out.bodyAttachment, {
      ...PROCESSED_ATTACHMENT,
      downloadPath: 'random-path',
      contentType: LONG_MESSAGE,
    });
  });

  it('should process attachments with incrementalMac/chunkSize', () => {
    const out = check({
      attachments: [
        {
          ...UNPROCESSED_ATTACHMENT,
          incrementalMac: new Uint8Array([0, 0, 0]),
          chunkSize: 2,
        },
      ],
    });

    assert.deepStrictEqual(out.attachments, [
      {
        ...PROCESSED_ATTACHMENT,
        downloadPath: 'random-path',
        incrementalMac: 'AAAA',
        chunkSize: 2,
      },
    ]);
  });

  it('should throw on too many attachments', () => {
    const attachments: Array<Proto.IAttachmentPointer> = [];
    for (let i = 0; i < ATTACHMENT_MAX + 1; i += 1) {
      attachments.push(UNPROCESSED_ATTACHMENT);
    }

    assert.throws(
      () => check({ attachments }),
      `Too many attachments: ${ATTACHMENT_MAX + 1} included in one message` +
        `, max is ${ATTACHMENT_MAX}`
    );
  });

  it('should process groupv2 context', () => {
    const out = check({
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

  it('should base64 profileKey', () => {
    const out = check({
      profileKey: new Uint8Array([42, 23, 55]),
    });

    assert.strictEqual(out.profileKey, 'Khc3');
  });

  it('should process quote, dropping second attachment', () => {
    const out = check({
      quote: {
        id: Long.fromNumber(1),
        authorAciBinary: ACI_BINARY_1,
        text: 'text',
        attachments: [
          {
            contentType: 'image/jpeg',
            fileName: 'image1.jpg',
            thumbnail: UNPROCESSED_ATTACHMENT,
          },
          {
            contentType: 'image/jpeg',
            fileName: 'image2.jpg',
            thumbnail: UNPROCESSED_ATTACHMENT,
          },
        ],
      },
    });

    assert.deepStrictEqual(out.quote, {
      id: 1,
      authorAci: ACI_1,
      text: 'text',
      attachments: [
        {
          contentType: IMAGE_JPEG,
          fileName: 'image1.jpg',
          thumbnail: PROCESSED_ATTACHMENT,
        },
      ],
      bodyRanges: undefined,
      type: 0,
    });
  });

  it('should process contact, dropping second contact', () => {
    const out = check({
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
    ]);
  });

  it('should process preview, dropping second preview', () => {
    const out = check({
      preview: [
        {
          description:
            'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
          image: UNPROCESSED_ATTACHMENT,
          title: 'Signal Private Messenger #1',
          url: 'https://signal.org',
        },
        {
          description: 'Say "hello" again',
          image: UNPROCESSED_ATTACHMENT,
          title: 'Signal Private Messenger #2',
          url: 'https://signal.org',
        },
      ],
    });

    assert.deepStrictEqual(out.preview, [
      {
        date: undefined,
        description:
          'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
        image: PROCESSED_ATTACHMENT,
        title: 'Signal Private Messenger #1',
        url: 'https://signal.org',
      },
    ]);
  });

  it('should process reaction', () => {
    assert.deepStrictEqual(
      check({
        reaction: {
          emoji: '😎',
          targetAuthorAciBinary: ACI_BINARY_1,
          targetSentTimestamp: Long.fromNumber(TIMESTAMP),
        },
      }).reaction,
      {
        emoji: '😎',
        remove: false,
        targetAuthorAci: ACI_1,
        targetTimestamp: TIMESTAMP,
      }
    );

    assert.deepStrictEqual(
      check({
        reaction: {
          emoji: '😎',
          remove: true,
          targetAuthorAciBinary: ACI_BINARY_1,
          targetSentTimestamp: Long.fromNumber(TIMESTAMP),
        },
      }).reaction,
      {
        emoji: '😎',
        remove: true,
        targetAuthorAci: ACI_1,
        targetTimestamp: TIMESTAMP,
      }
    );
  });

  it('should process preview', () => {
    const out = check({
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

  it('should process sticker', () => {
    const out = check({
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

  it('should process FLAGS=END_SESSION', () => {
    const out = check({
      flags: FLAGS.END_SESSION,
      body: 'should be deleted',
      attachments: [UNPROCESSED_ATTACHMENT],
    });

    assert.isUndefined(out.body);
    assert.deepStrictEqual(out.attachments, []);
  });

  it('should process FLAGS=EXPIRATION_TIMER_UPDATE,PROFILE_KEY_UPDATE', () => {
    const values = [FLAGS.EXPIRATION_TIMER_UPDATE, FLAGS.PROFILE_KEY_UPDATE];
    for (const flags of values) {
      const out = check({
        flags,
        body: 'should be deleted',
        attachments: [UNPROCESSED_ATTACHMENT],
      });

      assert.isUndefined(out.body);
      assert.deepStrictEqual(out.attachments, []);
    }
  });

  it('processes trivial fields', () => {
    assert.strictEqual(check({ flags: null }).flags, 0);
    assert.strictEqual(check({ flags: 1 }).flags, 1);

    assert.strictEqual(check({ expireTimer: null }).expireTimer, 0);
    assert.strictEqual(check({ expireTimer: 123 }).expireTimer, 123);

    assert.isFalse(check({ isViewOnce: null }).isViewOnce);
    assert.isFalse(check({ isViewOnce: false }).isViewOnce);
    assert.isTrue(check({ isViewOnce: true }).isViewOnce);
  });
});
