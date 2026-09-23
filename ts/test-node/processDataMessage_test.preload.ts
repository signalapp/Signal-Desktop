// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import {
  ATTACHMENT_MAX,
  processDataMessage,
} from '../textsecure/processDataMessage.preload.ts';
import type { ProcessedAttachment } from '../textsecure/Types.d.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import {
  APPLICATION_OCTET_STREAM,
  AUDIO_MP3,
  IMAGE_GIF,
  IMAGE_JPEG,
  LONG_MESSAGE,
  VIDEO_MP4,
} from '../types/MIME.std.ts';
import { toAciObject } from '../util/ServiceId.node.ts';
import { uuidToBytes } from '../util/uuidToBytes.std.ts';
import { generateAci } from '../test-helpers/serviceIdUtils.std.ts';
import { Emoji } from '../axo/emoji.std.ts';

const ACI_1 = generateAci();
const ACI_BINARY_1 = toAciObject(ACI_1).getRawUuidBytes();
const FLAGS = Proto.DataMessage.Flags;

const TIMESTAMP = Date.now();
const CLIENT_UUID = generateUuid();

const EMPTY_DATA_MESSAGE: Proto.DataMessage.Params = {
  body: null,
  attachments: null,
  groupV2: null,
  flags: null,
  expireTimer: null,
  expireTimerVersion: null,
  profileKey: null,
  timestamp: null,
  quote: null,
  contact: null,
  preview: null,
  sticker: null,
  requiredProtocolVersion: null,
  isViewOnce: null,
  reaction: null,
  delete: null,
  bodyRanges: null,
  groupCallUpdate: null,
  payment: null,
  storyContext: null,
  giftBadge: null,
  pollCreate: null,
  pollTerminate: null,
  pollVote: null,
  pinMessage: null,
  unpinMessage: null,
  adminDelete: null,
};

const UNPROCESSED_ATTACHMENT: Proto.AttachmentPointer.Params = {
  attachmentIdentifier: {
    cdnKey: 'cdnKey',
  },
  cdnNumber: 2,
  blurHash: 'blurHash',
  caption: 'caption',
  clientUuid: uuidToBytes(CLIENT_UUID),
  key: new Uint8Array([1, 2, 3]),
  digest: new Uint8Array([4, 5, 6]),
  contentType: IMAGE_GIF,
  incrementalMac: new Uint8Array([12, 12, 12]),
  chunkSize: 24,
  uploadTimestamp: 456n,
  size: 34,
  height: 64,
  width: 128,
  flags: 0,
  fileName: 'fileName',
  thumbnail: null,
};

const PROCESSED_ATTACHMENT: ProcessedAttachment = {
  cdnId: undefined,
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
  flags: 0,
  fileName: 'fileName',
};

const IMAGE = { contentType: IMAGE_JPEG };
const VIDEO = { contentType: VIDEO_MP4 };
const FILE = { contentType: APPLICATION_OCTET_STREAM };
const AUDIO = { contentType: AUDIO_MP3 };
const LONG_TEXT = { contentType: LONG_MESSAGE };
const VOICE = {
  contentType: AUDIO_MP3,
  flags: Proto.AttachmentPointer.Flags.VOICE_MESSAGE,
};
const GIF = {
  contentType: VIDEO_MP4,
  flags: Proto.AttachmentPointer.Flags.GIF,
};

describe('processDataMessage', () => {
  const check = (
    message: Partial<Omit<Proto.DataMessage.Params, 'timestamp'>>
  ) =>
    processDataMessage(
      Proto.DataMessage.decode(
        Proto.DataMessage.encode({
          ...EMPTY_DATA_MESSAGE,
          timestamp: BigInt(TIMESTAMP),
          ...message,
        })
      ),
      TIMESTAMP,
      {
        _createName: () => 'random-path',
      }
    );

  const unprocessed = (
    overrides?: Partial<Proto.AttachmentPointer.Params>
  ): Proto.AttachmentPointer.Params => ({
    ...UNPROCESSED_ATTACHMENT,
    flags: 0,
    ...overrides,
  });

  const processed = (
    overrides?: Partial<ProcessedAttachment>
  ): ProcessedAttachment => ({
    ...PROCESSED_ATTACHMENT,
    flags: 0,
    downloadPath: 'random-path',
    ...overrides,
  });

  it('should process attachments', () => {
    const out = check({
      attachments: [unprocessed()],
    });

    assert.deepStrictEqual(out.attachments, [processed()]);
  });

  it('should process attachments with null fileName', () => {
    const out = check({
      attachments: [unprocessed({ fileName: null })],
    });

    assert.deepStrictEqual(out.attachments, [
      processed({ fileName: undefined }),
    ]);
  });

  it('should process attachments with 0 cdnId', () => {
    const out = check({
      attachments: [
        unprocessed({
          attachmentIdentifier: {
            cdnId: 0n,
          },
        }),
      ],
    });

    assert.deepStrictEqual(out.attachments, [
      processed({
        cdnId: undefined,
        cdnKey: undefined,
      }),
    ]);
  });

  it('should move long text attachments to bodyAttachment', () => {
    const out = check({
      attachments: [unprocessed(), unprocessed(LONG_TEXT)],
    });

    assert.deepStrictEqual(out.attachments, [processed()]);
    assert.deepStrictEqual(out.bodyAttachment, processed(LONG_TEXT));
  });

  it('caps the number of attachments at ATTACHMENT_MAX', () => {
    const attachments: Array<Proto.AttachmentPointer.Params> = [];
    for (let i = 0; i < ATTACHMENT_MAX + 5; i += 1) {
      attachments.push(unprocessed(IMAGE));
    }

    const out = check({ attachments });

    assert.equal(out.attachments.length, ATTACHMENT_MAX);
    assert.deepStrictEqual(
      out.attachments,
      Array.from({ length: ATTACHMENT_MAX }, () => processed(IMAGE))
    );
  });

  it('allows long text + ATTACHMENT_MAX attachments', () => {
    const attachments: Array<Proto.AttachmentPointer.Params> = [
      unprocessed(LONG_TEXT),
    ];
    for (let i = 0; i < ATTACHMENT_MAX; i += 1) {
      attachments.push(unprocessed(IMAGE));
    }

    const out = check({ attachments });

    assert.deepStrictEqual(out.bodyAttachment, processed(LONG_TEXT));
    assert.deepStrictEqual(
      out.attachments,
      Array.from({ length: ATTACHMENT_MAX }, () => processed(IMAGE))
    );
  });

  it('should process attachments with incrementalMac/chunkSize', () => {
    const out = check({
      attachments: [
        unprocessed({
          incrementalMac: new Uint8Array([0, 0, 0]),
          chunkSize: 2,
        }),
      ],
    });

    assert.deepStrictEqual(out.attachments, [
      processed({
        incrementalMac: 'AAAA',
        chunkSize: 2,
      }),
    ]);
  });

  describe('drops attachments the UI would never render', () => {
    it('keeps only the voice message', () => {
      const out = check({
        attachments: [unprocessed(VOICE), unprocessed(FILE)],
      });

      assert.deepStrictEqual(out.attachments, [processed(VOICE)]);
    });

    it('keeps only the first audio attachment', () => {
      const out = check({
        attachments: [
          unprocessed(AUDIO),
          unprocessed(AUDIO),
          unprocessed(IMAGE),
        ],
      });

      assert.deepStrictEqual(out.attachments, [processed(AUDIO)]);
    });

    it('keeps only GIF (rendered alone)', () => {
      const out = check({
        attachments: [unprocessed(GIF), unprocessed(IMAGE)],
      });

      assert.deepStrictEqual(out.attachments, [processed(GIF)]);
    });

    it('keeps only the first file attachment', () => {
      const out = check({
        attachments: [unprocessed(FILE), unprocessed(FILE)],
      });

      assert.deepStrictEqual(out.attachments, [processed(FILE)]);
    });

    it('keeps only the file when it leads visual media', () => {
      const out = check({
        attachments: [unprocessed(FILE), unprocessed(IMAGE)],
      });

      assert.deepStrictEqual(out.attachments, [processed(FILE)]);
    });

    it('keeps the leading run of visual media', () => {
      const out = check({
        attachments: [
          unprocessed(IMAGE),
          unprocessed(VIDEO),
          unprocessed(FILE),
        ],
      });

      assert.deepStrictEqual(out.attachments, [
        processed(IMAGE),
        processed(VIDEO),
      ]);
    });

    it('stops at the first non-visual attachment', () => {
      const out = check({
        attachments: [
          unprocessed(IMAGE),
          unprocessed(FILE),
          unprocessed(IMAGE),
        ],
      });

      assert.deepStrictEqual(out.attachments, [processed(IMAGE)]);
    });

    it('keeps every attachment when they are all visual', () => {
      const out = check({
        attachments: [
          unprocessed(IMAGE),
          unprocessed(VIDEO),
          unprocessed(IMAGE),
        ],
      });

      assert.deepStrictEqual(out.attachments, [
        processed(IMAGE),
        processed(VIDEO),
        processed(IMAGE),
      ]);
    });
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
        id: 1n,
        authorAci: null,
        authorAciBinary: ACI_BINARY_1,
        text: 'text',
        bodyRanges: null,
        type: null,
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
      bodyRanges: [],
      type: 0,
    });
  });

  it('should process contact, dropping second contact', () => {
    const EMPTY_CONTACT = {
      $unknown: [],
      number: [],
      name: null,
      email: [],
      address: [],
      organization: '',
    };
    const out = check({
      contact: [
        {
          ...EMPTY_CONTACT,
          avatar: {
            avatar: UNPROCESSED_ATTACHMENT,
            isProfile: false,
          },
        },
        {
          ...EMPTY_CONTACT,
          avatar: {
            avatar: UNPROCESSED_ATTACHMENT,
            isProfile: true,
          },
        },
      ],
    });

    assert.deepStrictEqual(out.contact, [
      {
        ...EMPTY_CONTACT,
        avatar: {
          avatar: PROCESSED_ATTACHMENT,
          isProfile: false,
        },
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
          date: null,
        },
        {
          description: 'Say "hello" again',
          image: UNPROCESSED_ATTACHMENT,
          title: 'Signal Private Messenger #2',
          url: 'https://signal.org',
          date: null,
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
          emoji: Emoji.COOL,
          remove: null,
          targetAuthorAci: null,
          targetAuthorAciBinary: ACI_BINARY_1,
          targetSentTimestamp: BigInt(TIMESTAMP),
        },
      }).reaction,
      {
        emoji: Emoji.COOL,
        remove: false,
        targetAuthorAci: ACI_1,
        targetTimestamp: TIMESTAMP,
      }
    );

    assert.deepStrictEqual(
      check({
        reaction: {
          emoji: Emoji.COOL,
          remove: true,
          targetAuthorAci: null,
          targetAuthorAciBinary: ACI_BINARY_1,
          targetSentTimestamp: BigInt(TIMESTAMP),
        },
      }).reaction,
      {
        emoji: Emoji.COOL,
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
          date: BigInt(TIMESTAMP),
          image: UNPROCESSED_ATTACHMENT,
          url: null,
          title: null,
          description: null,
        },
      ],
    });

    assert.deepStrictEqual(out.preview, [
      {
        date: TIMESTAMP,
        description: '',
        title: '',
        url: '',
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
      emoji: Emoji.ONE_HUNDRED,
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

  it('should process poll votes', () => {
    assert.deepStrictEqual(
      check({
        pollVote: {
          targetAuthorAciBinary: ACI_BINARY_1,
          targetSentTimestamp: BigInt(TIMESTAMP),
          optionIndexes: [0],
          voteCount: 1,
        },
      }).pollVote,
      {
        targetAuthorAci: ACI_1,
        targetTimestamp: TIMESTAMP,
        optionIndexes: [0],
        voteCount: 1,
      }
    );
  });

  it('should drop duplicate poll vote indexes', () => {
    assert.deepStrictEqual(
      check({
        pollVote: {
          targetAuthorAciBinary: ACI_BINARY_1,
          targetSentTimestamp: BigInt(TIMESTAMP),
          optionIndexes: [0, 0, 1, 1],
          voteCount: 1,
        },
      }).pollVote,
      {
        targetAuthorAci: ACI_1,
        targetTimestamp: TIMESTAMP,
        optionIndexes: [0, 1],
        voteCount: 1,
      }
    );
  });
});
