// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */

import { assert } from 'chai';
import Long from 'long';

import * as Bytes from '../../Bytes';
import type { LocalUserDataType } from '../../util/sessionTranslation';
import { sessionRecordToProtobuf } from '../../util/sessionTranslation';

const getRecordCopy = (record: any): any => JSON.parse(JSON.stringify(record));

export const SESSION_V1_RECORD = {
  sessions: {
    '\u0005W¿\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M': {
      registrationId: 4243,
      currentRatchet: {
        rootKey:
          'Ë\u00035/üÚg\u0003Xeûú\u0010\u0000ü\u0002¶»o5\u001c­¥\u0004Ðÿ«',
        lastRemoteEphemeralKey:
          '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs',
        previousCounter: 2,
        ephemeralKeyPair: {
          privKey: 'äãÅ«ªàøí)á\u0005Á"sJM.¨¡\u0012r(N\f9Ô\b',
          pubKey: '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1',
        },
      },
      indexInfo: {
        remoteIdentityKey: '\u0005¨¨©üÏäúoá©êO¢çúxr»Æ¿r²GùiT@',
        closed: -1,
        baseKey: '\u0005W¿\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M',
        baseKeyType: 2,
      },
      oldRatchetList: [
        {
          added: 1605579954962,
          ephemeralKey:
            '\u00050»­\n¨ÊAä\u0006¢Ç´d\u0002\u00129}%î}Î©Tc}8¼\u0011n\\',
        },
        {
          added: 1605580408250,
          ephemeralKey:
            '\u0005^Ä\nòÀ¢\u0000\u000f­A\\6+Ó\u001a÷&×$¸¬ÑÔ|<qSÖ\u001aÙh',
        },
        {
          added: 1605581155167,
          ephemeralKey: '\u0005<\u0017å)QàFîl29Ø\u001c Ý$·;udß\u0005I|f\u0006',
        },
        {
          added: 1605638524556,
          ephemeralKey: '\u0005¯jõ±ã0wÛPÐÂSÏ´;·&\u0011Â%º¯°ÝÙþêù8F',
        },
        {
          added: 1606761719753,
          ephemeralKey: '\u0005Î(ð>xÄÈ?þv~íkx â¬.ðoòDg\u001eß.\r',
        },
        {
          added: 1606766530935,
          ephemeralKey:
            '\u0005\u0014@½M,à\bóó}¨`i¿\u0000©I\u0001ôG\u001f:Ù{ó\u0005 ',
        },
        {
          added: 1608326293655,
          ephemeralKey: '\u0005µÒ\u0014?È¢+ÑR÷ç?3Dº\\@0\u0004®+-\br\t',
        },
        {
          added: 1609871105317,
          ephemeralKey:
            '\u0005±@íN"Í\u0019HS{$ï\u0017[Ñ\\\u001a*;>P\u0000\u001f\u000eHNaù)',
        },
        {
          added: 1611707063523,
          ephemeralKey: '\u0005ÞgÅké\u0001\u0013¡ÿûNXÈ(9\u0006¤w®/Ø¹RiJI',
        },
        {
          added: 1612211156372,
          ephemeralKey: '\u0005:[ÛOpd¯ ÂÙç\u0010OÞw{}ý\bw9Àß=\u0014Z',
        },
      ],
      '\u00050»­\n¨ÊAä\u0006¢Ç´d\u0002\u00129}%î}Î©Tc}8¼\u0011n\\': {
        messageKeys: {},
        chainKey: {
          counter: 0,
        },
        chainType: 2,
      },
      '\u0005^Ä\nòÀ¢\u0000\u000f­A\\6+Ó\u001a÷&×$¸¬ÑÔ|<qSÖ\u001aÙh': {
        messageKeys: {},
        chainKey: {
          counter: 2,
        },
        chainType: 2,
      },
      '\u0005<\u0017å)QàFîl29Ø\u001c Ý$·;udß\u0005I|f\u0006': {
        messageKeys: {},
        chainKey: {
          counter: 1,
        },
        chainType: 2,
      },
      '\u0005¯jõ±ã0wÛPÐÂSÏ´;·&\u0011Â%º¯°ÝÙþêù8F': {
        messageKeys: {
          '0': 'A/{´{×f(èaøy\\D¾\u0000ÃHÀÁâô$ã\u001d3Äö°Ù',
          '1': "Ì¶FT}dw8Æýª7»ÚÓ\u000f*'Ô»7£\u0018\u0012ñDá",
          '2': 'Îï\u0013¨ÁÕÎk\u000eýèÈ÷,¼îû5%ÓU¤6_õ¢\u0019ä]',
        },
        chainKey: {
          counter: 3,
        },
        chainType: 2,
      },
      '\u0005Î(ð>xÄÈ?þv~íkx â¬.ðoòDg\u001eß.\r': {
        messageKeys: {
          '4': '©}j¿¼\u0014q\t¥Áñ\u0003: ÷ÞrñûÔµ%Æ\u001a',
        },
        chainKey: {
          counter: 6,
        },
        chainType: 2,
      },
      '\u0005\u0014@½M,à\bóó}¨`i¿\u0000©I\u0001ôG\u001f:Ù{ó\u0005 ': {
        messageKeys: {},
        chainKey: {
          counter: 0,
        },
        chainType: 2,
      },
      '\u0005µÒ\u0014?È¢+ÑR÷ç?3Dº\\@0\u0004®+-\br\t': {
        messageKeys: {},
        chainKey: {
          counter: 2,
        },
        chainType: 2,
      },
      '\u0005±@íN"Í\u0019HS{$ï\u0017[Ñ\\\u001a*;>P\u0000\u001f\u000eHNaù)': {
        messageKeys: {
          '0': "1kÏ\u001cí+«<º\b'VÌ!×¼«PÃ[üáy;l'",
          '2': 'ö\u00047%L-Wm)\u001d£ääíNô.Ô8ÃÉ4r´ó^2',
          '3': '¨¿¦7T]\u001c\u001cà4:x\u0019¿\u0002YÉÀ\u001bâjr¸»¤¢0,*',
          '5': '¥\u0006·qgó4þ\u0011®U4F\u001cl©\bäô»ÊÇÆ[',
        },
        chainKey: {
          counter: 5,
        },
        chainType: 2,
      },
      '\u0005ÞgÅké\u0001\u0013¡ÿûNXÈ(9\u0006¤w®/Ø¹RiJI': {
        messageKeys: {
          '0': "]'8WÄ\u0007nº­Ö{ÿ7]ôäÄ!é\u000btA@°b¢)\u001ar",
          '2': '­ÄfGÇjÖxÅö:×RÔi)M\u0019©IE+¨`þKá;£Û½',
          '3': '¦Õhýø`ÖPéPs;\u001e\u000bE}¨¿õ\u0003uªøå\u00062(×G',
          '9': 'Ï^<ÕúÌ\u0001i´;ït¼\u001aÑ?ï\u0014lãàÆ¸\u001a8/m',
        },
        chainKey: {
          counter: 11,
        },
        chainType: 2,
      },
      '\u0005:[ÛOpd¯ ÂÙç\u0010OÞw{}ý\bw9Àß=\u0014Z': {
        messageKeys: {
          '0': '!\u00115\\W~|¯oa2\u001e\u0004V8Ï¡d}\u001b\u001a8^QÖfvÕ"',
        },
        chainKey: {
          counter: 1,
        },
        chainType: 2,
      },
      '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs': {
        messageKeys: {
          '0': 'Îgó¯2àvñX_õ\u0014Ç\u0000öl\u001f4J>ÐÏ{`-Ü5¦',
          '4': 'c¿<µâ¼Xµ!Ù¯µ®[n<ìîúcoå©n\u0013"l]Ð',
        },
        chainKey: {
          counter: 5,
          key: 'Z{òÙ8Ø³AÝdSZk\nÃ\u001cô¡\u001b[YÒÂ¶\u0016a°\u0004<',
        },
        chainType: 2,
      },
      '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1': {
        messageKeys: {},
        chainKey: {
          counter: -1,
          key: "èB?7\u000f¯\u001e\u0010¨\u0007}:?¹\u0010$\\ë~ª\u0000gM0Õ'£\u0005",
        },
        chainType: 1,
      },
    },
  },
  version: 'v1',
} as any;

function protoToJSON(value: unknown): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64');
  }

  if (Array.isArray(value)) {
    return value.map(protoToJSON);
  }

  if (Long.isLong(value)) {
    return value.toNumber();
  }

  if (typeof value === 'object') {
    const res: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      res[key] = protoToJSON((value as Record<string, unknown>)[key]);
    }
    return res;
  }

  return value;
}

describe('sessionTranslation', () => {
  let ourData: LocalUserDataType;

  beforeEach(() => {
    ourData = {
      identityKeyPublic: Bytes.fromBase64(
        'Baioqfzc/5JD6b+GNqapPouf6eHK7xr9ynLJHnvl+444'
      ),
      registrationId: 3554,
    };
  });

  it('Throws if given an empty object', () => {
    const record: any = {};
    assert.throws(
      () => sessionRecordToProtobuf(record, ourData),
      'toProtobuf: Record had no sessions!'
    );
  });

  it('Generates expected protobuf with minimal record', () => {
    const record: any = {
      sessions: {
        '\u0005W¿\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M': {
          registrationId: 4243,
          currentRatchet: {
            rootKey:
              'Ë\u00035/üÚg\u0003Xeûú\u0010\u0000ü\u0002¶»o5\u001c­¥\u0004Ðÿ«',
            lastRemoteEphemeralKey:
              '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs',
            previousCounter: 2,
            ephemeralKeyPair: {
              privKey: 'äãÅ«ªàøí)á\u0005Á"sJM.¨¡\u0012r(N\f9Ô\b',
              pubKey: '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1',
            },
          },
          indexInfo: {
            remoteIdentityKey: '\u0005¨¨©üÏäúoá©êO¢çúxr»Æ¿r²GùiT@',
            closed: -1,
            baseKey: '\u0005W¿\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M',
            baseKeyType: 2,
          },
          oldRatchetList: [],
          '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs': {
            messageKeys: {
              '0': 'Îgó¯2àvñX_õ\u0014Ç\u0000öl\u001f4J>ÐÏ{`-Ü5¦',
              '4': 'c¿<µâ¼Xµ!Ù¯µ®[n<ìîúcoå©n\u0013"l]Ð',
            },
            chainKey: {
              counter: 5,
              key: 'Z{òÙ8Ø³AÝdSZk\nÃ\u001cô¡\u001b[YÒÂ¶\u0016a°\u0004<',
            },
            chainType: 2,
          },
          '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1': {
            messageKeys: {},
            chainKey: {
              counter: -1,
              key: "èB?7\u000f¯\u001e\u0010¨\u0007}:?¹\u0010$\\ë~ª\u0000gM0Õ'£\u0005",
            },
            chainType: 1,
          },
        },
      },
      version: 'v1',
    };

    const expected = {
      currentSession: {
        sessionVersion: 3,
        localIdentityPublic: 'Baioqfzc/5JD6b+GNqapPouf6eHK7xr9ynLJHnvl+444',
        remoteIdentityPublic: 'BaioqfzP5JD6b+GNqepPouf6eHK7xr9ynLJHnvlpgVRA',
        rootKey: 'ywM1L/yc2ppnA1hl+/oQlwD8Ara7bzUcg5etpQTQ/6s=',
        previousCounter: 3,
        senderChain: {
          senderRatchetKey: 'BSsTNJarMQATbCAq40vnbrrW87PtVFOfJox7+SDNgj4x',
          senderRatchetKeyPrivate:
            '5JfjxauqiuD47SmI4QXBIoxzSk0uqKEScp0oTgw51Ag=',
          chainKey: {
            index: 0,
            key: '6EI/Nw+vHhCoB499OpM/kLkQJFzrfqoAZ00w1ZgnowU=',
          },
          messageKeys: [],
        },
        receiverChains: [
          {
            senderRatchetKey: 'BQo3HG1UhWIh6A7NBxZtNGezBZH8nElZjOqNCBHPzlBz',
            chainKey: {
              index: 6,
              key: 'Wnvy2TjYs0HdZFNahmsKw5cc9KEbW1nSwraDFmGwBDw=',
            },
            messageKeys: [
              {
                index: 1,
                cipherKey: 'xVreEbT7Vtrxs85JyGBj6Y+UWftQz4H72F5kWV4cxqM=',
                iv: 'TcRanSxZVWbuIq0xDRGnEw==',
                macKey: '5fW9aIKXhtwWp/5alNJUIXInZbztf2ywzQSpYrXoQ3A=',
              },
              {
                index: 5,
                cipherKey: 'A99HjM4pUugsQ5+2v48FGTGEhZPoW6wzW9MqSc11QQ4=',
                iv: 'bE8Ei2Rkaoz4SKRwdG4+tQ==',
                macKey: 'TOTdbAf0bCHOzcQ3lBaIm3yqmpEqvvldD0qTuDFmkAI=',
              },
            ],
          },
        ],
        remoteRegistrationId: 4243,
        localRegistrationId: 3554,
        aliceBaseKey: 'BVeHv5MAbMgKeaoO/G1CMBdqhC7bo7Mtc4EWxI0oT19N',
      },
      previousSessions: [],
    };

    const recordCopy = getRecordCopy(record);

    const actual = sessionRecordToProtobuf(record, ourData);

    assert.deepEqual(expected, protoToJSON(actual));

    // We want to ensure that conversion doesn't modify incoming data
    assert.deepEqual(record, recordCopy);
  });

  it('Generates expected protobuf with many old receiver chains', () => {
    const record: any = SESSION_V1_RECORD;

    const expected = {
      currentSession: {
        sessionVersion: 3,
        localIdentityPublic: 'Baioqfzc/5JD6b+GNqapPouf6eHK7xr9ynLJHnvl+444',
        remoteIdentityPublic: 'BaioqfzP5JD6b+GNqepPouf6eHK7xr9ynLJHnvlpgVRA',
        rootKey: 'ywM1L/yc2ppnA1hl+/oQlwD8Ara7bzUcg5etpQTQ/6s=',
        previousCounter: 3,
        senderChain: {
          senderRatchetKey: 'BSsTNJarMQATbCAq40vnbrrW87PtVFOfJox7+SDNgj4x',
          senderRatchetKeyPrivate:
            '5JfjxauqiuD47SmI4QXBIoxzSk0uqKEScp0oTgw51Ag=',
          chainKey: {
            index: 0,
            key: '6EI/Nw+vHhCoB499OpM/kLkQJFzrfqoAZ00w1ZgnowU=',
          },
          messageKeys: [],
        },
        receiverChains: [
          {
            senderRatchetKey: 'BQo3HG1UhWIh6A7NBxZtNGezBZH8nElZjOqNCBHPzlBz',
            chainKey: {
              index: 6,
              key: 'Wnvy2TjYs0HdZFNahmsKw5cc9KEbW1nSwraDFmGwBDw=',
            },
            messageKeys: [
              {
                index: 1,
                cipherKey: 'xVreEbT7Vtrxs85JyGBj6Y+UWftQz4H72F5kWV4cxqM=',
                iv: 'TcRanSxZVWbuIq0xDRGnEw==',
                macKey: '5fW9aIKXhtwWp/5alNJUIXInZbztf2ywzQSpYrXoQ3A=',
              },
              {
                index: 5,
                cipherKey: 'A99HjM4pUugsQ5+2v48FGTGEhZPoW6wzW9MqSc11QQ4=',
                iv: 'bE8Ei2Rkaoz4SKRwdG4+tQ==',
                macKey: 'TOTdbAf0bCHOzcQ3lBaIm3yqmpEqvvldD0qTuDFmkAI=',
              },
            ],
          },
          {
            senderRatchetKey: 'BTpb20+IlnBkryDC2ecQT96Hd3t9/Qh3ljnA3509kxRa',
            chainKey: {
              index: 2,
            },
            messageKeys: [
              {
                index: 1,
                cipherKey: 'aAbSz5jOagUTgQKo3aqExcl8hyZANrY+HvrLc/OgoQI=',
                iv: 'JcyLzw0fL67Kd4tfGJ2OUQ==',
                macKey: 'dt+RXeaeIx+ASrKSk7D4guwTE1IUYl3LiLG9aI4sZm8=',
              },
            ],
          },
          {
            senderRatchetKey: 'Bd5nlMVr6YMBE5eh//tOWMgoOQakkneYri/YuVJpi0pJ',
            chainKey: {
              index: 12,
            },
            messageKeys: [
              {
                index: 1,
                cipherKey: 'pjcY/7MoRGtGHwNN/E8KqoKCx/5mdKp0VCmrmkBAj+M=',
                iv: 'eBpAEoDj94NsI0vsf+4Hrw==',
                macKey: 'P7Jz2KkOXC7B0mLkz7JaU/d0vdaYZjAfuKJ86xXB19U=',
              },
              {
                index: 3,
                cipherKey: 'EGDj0sc/1TMtSycYDCrpZdl6UCzCzDuMwlAvVVAs2OQ=',
                iv: 'A+1OA9M2Z8gGlARtA231RA==',
                macKey: 'oQ/PQxJDD52qrkShSy6hD3fASEfhWnlmY3qsSPuOY/o=',
              },
              {
                index: 4,
                cipherKey: 'WM3UUILGdECXjO8jZbBVYrPAnzRM8RdiU+PSAyHUT5U=',
                iv: 'CWuQIuIyGqApA6MQgnDR5Q==',
                macKey: 'hg+/xrOKFzn2eK1BnJ5C+ERsFgaWAOaBxQTc4q3b/g8=',
              },
              {
                index: 10,
                cipherKey: 'T0cBaGAseFz+s2njVr4sqbFf1pUH5PoPvdMBoizIT+Y=',
                iv: 'hkT2kqgqhlORAjBI7ZDsig==',
                macKey: 'uE/Dd4WSQWkYNRgolcQtOd+HpaHP5wGogMzErkZj+AQ=',
              },
            ],
          },
          {
            senderRatchetKey: 'BYSxQO1OIs0ZSFN7JI/vF5Rb0VwaKjs+UAAfDkhOYfkp',
            chainKey: {
              index: 6,
            },
            messageKeys: [
              {
                index: 1,
                cipherKey: 'ni6XhRCoLFud2Zk1zoel4he8znDG/t+TWVBASO35GlQ=',
                iv: 'rKy/sxLmQ4j2DSxbDZTO5A==',
                macKey: 'MKxs29AmNOnp6zZOsIbrmSqcVXYJL01kuvIaqwjRNvQ=',
              },
              {
                index: 3,
                cipherKey: 'Pp7GOD72vfjvb3qx7qm1YVoZKPqnyXC2uqCt89ZA/yc=',
                iv: 'NuDf5iM0lD/o0YzjHZo4mA==',
                macKey: 'JkBZiaxmwFr1xh/zzTQE6mlUIVJmSIrqSIQVlaoTz7M=',
              },
              {
                index: 4,
                cipherKey: 'zORWRvJEUe2F4UnBwe2YRqPS4GzUFE1lWptcqMzWf2U=',
                iv: 'Og7jF9JJhiLtPD8W2OgTnw==',
                macKey: 'Lxbcl9fL9x5Javtdz7tOV7Bbr8ar3rWxSIsi1Focv9w=',
              },
              {
                index: 6,
                cipherKey: 'T/TZNw04+ZfB0s2ltOT9qbzRPnCFn7VvxqHHAvORFx0=',
                iv: 'DpOAK77ErIr2QFTsRnfOew==',
                macKey: 'k/fxafepBiA0dQOTpohL+EKm2+1jpFwRigVWt02U/Jg=',
              },
            ],
          },
          {
            senderRatchetKey: 'BbXSFD/IoivRUvfnPzOaRLqDXEAwi4YEristfwiOj3IJ',
            chainKey: {
              index: 3,
            },
            messageKeys: [],
          },
          {
            senderRatchetKey: 'BRRAnr1NhizgCPPzmYV9qGBpvwCpSQH0Rx+UOtl78wUg',
            chainKey: {
              index: 1,
            },
            messageKeys: [],
          },
          {
            senderRatchetKey: 'BZvOKPA+kXiCg8TIP/52fu1reCDirC7wb5nyRGce3y4N',
            chainKey: {
              index: 7,
            },
            messageKeys: [
              {
                index: 5,
                cipherKey: 'PB44plPzHam/o2LZnyjo8HLRuAvp3uE6ixO5+GUCUsA=',
                iv: 'JBbgRb10X/dDsn0GKg69dA==',
                macKey: 'jKV1Rmlb0HATZHndLDIMONPgOXqT3kwE1QEstxXVe+o=',
              },
            ],
          },
          {
            senderRatchetKey: 'Ba9q9bHjMHfbUNDCU8+0O7cmEcIluq+wk3/d2f7q+ThG',
            chainKey: {
              index: 4,
            },
            messageKeys: [
              {
                index: 1,
                cipherKey: '4buOJSqRFIpWwo4pXYwQTCTxas4+amBLpZ/CuEWXbPg=',
                iv: '9uD8ECO/fxtK28OvlCFXuQ==',
                macKey: 'LI0ZSdX7k+cd5bTgs6XEYYIWY+2cxhWI97vAGFpoZIc=',
              },
              {
                index: 2,
                cipherKey: 'oNbFxcy2eebUQhoD+NLf12fgkXzhn4EU0Pgqn1bVKOs=',
                iv: 'o1mm4rCN6Q0J1hA7I5jjgA==',
                macKey: 'dfHB14sCIdun+RaKnAoyaQPC6qRDMewjqOIDZGmn3Es=',
              },
              {
                index: 3,
                cipherKey: '/aU3zX2IdA91GAcB+7H57yzRe+6CgZ61tlW4M/rkCJI=',
                iv: 'v8VJF467QDD1ZCr1JD8pbQ==',
                macKey: 'MjK5iYjhZtQTJ4Eu3+qGOdYxn0G23EGRtTcusbzy9OA=',
              },
            ],
          },
          {
            senderRatchetKey: 'BTwX5SmcUeBG7mwyOZ3YgxyXIN0ktzuEdWTfBUmPfGYG',
            chainKey: {
              index: 2,
            },
            messageKeys: [],
          },
          {
            senderRatchetKey: 'BV7ECvKbwKIAD61BXDYr0xr3JtckuKzR1Hw8cVPWGtlo',
            chainKey: {
              index: 3,
            },
            messageKeys: [],
          },
          {
            senderRatchetKey: 'BTC7rQqoykGR5Aaix7RkAhI5fSXufc6pVGN9OIC8EW5c',
            chainKey: {
              index: 1,
            },
            messageKeys: [],
          },
        ],
        remoteRegistrationId: 4243,
        localRegistrationId: 3554,
        aliceBaseKey: 'BVeHv5MAbMgKeaoO/G1CMBdqhC7bo7Mtc4EWxI0oT19N',
      },
      previousSessions: [],
    };

    const recordCopy = getRecordCopy(record);

    const actual = sessionRecordToProtobuf(record, ourData);

    assert.deepEqual(expected, protoToJSON(actual));

    // We want to ensure that conversion doesn't modify incoming data
    assert.deepEqual(record, recordCopy);
  });

  it('Generates expected protobuf with pending prekey', () => {
    const record: any = {
      sessions: {
        '\u0005W¿\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M': {
          registrationId: 4243,
          currentRatchet: {
            rootKey:
              'Ë\u00035/üÚg\u0003Xeûú\u0010\u0000ü\u0002¶»o5\u001c­¥\u0004Ðÿ«',
            lastRemoteEphemeralKey:
              '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs',
            previousCounter: 2,
            ephemeralKeyPair: {
              privKey: 'äãÅ«ªàøí)á\u0005Á"sJM.¨¡\u0012r(N\f9Ô\b',
              pubKey: '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1',
            },
          },
          indexInfo: {
            remoteIdentityKey: '\u0005¨¨©üÏäúoá©êO¢çúxr»Æ¿r²GùiT@',
            closed: -1,
            baseKey: '\u0005W¿\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M',
            baseKeyType: 2,
          },
          pendingPreKey: {
            baseKey: '\u0005ui©üÏäúoá©êO¢çúxr»Æ¿r²GùiT@',
            signedKeyId: 38,
            preKeyId: 2,
          },
          oldRatchetList: [],
          '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs': {
            messageKeys: {
              '0': 'Îgó¯2àvñX_õ\u0014Ç\u0000öl\u001f4J>ÐÏ{`-Ü5¦',
              '4': 'c¿<µâ¼Xµ!Ù¯µ®[n<ìîúcoå©n\u0013"l]Ð',
            },
            chainKey: {
              counter: 5,
              key: 'Z{òÙ8Ø³AÝdSZk\nÃ\u001cô¡\u001b[YÒÂ¶\u0016a°\u0004<',
            },
            chainType: 2,
          },
          '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1': {
            messageKeys: {},
            chainKey: {
              counter: -1,
              key: "èB?7\u000f¯\u001e\u0010¨\u0007}:?¹\u0010$\\ë~ª\u0000gM0Õ'£\u0005",
            },
            chainType: 1,
          },
        },
      },
      version: 'v1',
    };

    const expected = {
      currentSession: {
        sessionVersion: 3,
        localIdentityPublic: 'Baioqfzc/5JD6b+GNqapPouf6eHK7xr9ynLJHnvl+444',
        remoteIdentityPublic: 'BaioqfzP5JD6b+GNqepPouf6eHK7xr9ynLJHnvlpgVRA',
        rootKey: 'ywM1L/yc2ppnA1hl+/oQlwD8Ara7bzUcg5etpQTQ/6s=',
        previousCounter: 3,
        senderChain: {
          senderRatchetKey: 'BSsTNJarMQATbCAq40vnbrrW87PtVFOfJox7+SDNgj4x',
          senderRatchetKeyPrivate:
            '5JfjxauqiuD47SmI4QXBIoxzSk0uqKEScp0oTgw51Ag=',
          chainKey: {
            index: 0,
            key: '6EI/Nw+vHhCoB499OpM/kLkQJFzrfqoAZ00w1ZgnowU=',
          },
          messageKeys: [],
        },
        receiverChains: [
          {
            senderRatchetKey: 'BQo3HG1UhWIh6A7NBxZtNGezBZH8nElZjOqNCBHPzlBz',
            chainKey: {
              index: 6,
              key: 'Wnvy2TjYs0HdZFNahmsKw5cc9KEbW1nSwraDFmGwBDw=',
            },
            messageKeys: [
              {
                index: 1,
                cipherKey: 'xVreEbT7Vtrxs85JyGBj6Y+UWftQz4H72F5kWV4cxqM=',
                iv: 'TcRanSxZVWbuIq0xDRGnEw==',
                macKey: '5fW9aIKXhtwWp/5alNJUIXInZbztf2ywzQSpYrXoQ3A=',
              },
              {
                index: 5,
                cipherKey: 'A99HjM4pUugsQ5+2v48FGTGEhZPoW6wzW9MqSc11QQ4=',
                iv: 'bE8Ei2Rkaoz4SKRwdG4+tQ==',
                macKey: 'TOTdbAf0bCHOzcQ3lBaIm3yqmpEqvvldD0qTuDFmkAI=',
              },
            ],
          },
        ],
        pendingPreKey: {
          preKeyId: 2,
          baseKey: 'BXVpqfzP5JD6b+GNqepPouf6eHK7xr9ynLJHnvlpgVRA',
          signedPreKeyId: 38,
        },
        remoteRegistrationId: 4243,
        localRegistrationId: 3554,
        aliceBaseKey: 'BVeHv5MAbMgKeaoO/G1CMBdqhC7bo7Mtc4EWxI0oT19N',
      },
      previousSessions: [],
    };

    const recordCopy = getRecordCopy(record);

    const actual = sessionRecordToProtobuf(record, ourData);

    assert.deepEqual(expected, protoToJSON(actual));

    // We want to ensure that conversion doesn't modify incoming data
    assert.deepEqual(record, recordCopy);
  });

  it('Generates expected protobuf with multiple sessions', () => {
    const record: any = {
      sessions: {
        '\u0005W¿\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M': {
          registrationId: 4243,
          currentRatchet: {
            rootKey:
              'Ë\u00035/üÚg\u0003Xeûú\u0010\u0000ü\u0002¶»o5\u001c­¥\u0004Ðÿ«',
            lastRemoteEphemeralKey:
              '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs',
            previousCounter: 2,
            ephemeralKeyPair: {
              privKey: 'äãÅ«ªàøí)á\u0005Á"sJM.¨¡\u0012r(N\f9Ô\b',
              pubKey: '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1',
            },
          },
          indexInfo: {
            remoteIdentityKey: '\u0005¨¨©üÏäúoá©êO¢çúxr»Æ¿r²GùiT@',
            closed: -1,
            baseKey: '\u0005W¿\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M',
            baseKeyType: 2,
          },
          oldRatchetList: [],
          '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs': {
            messageKeys: {
              '0': 'Îgó¯2àvñX_õ\u0014Ç\u0000öl\u001f4J>ÐÏ{`-Ü5¦',
              '4': 'c¿<µâ¼Xµ!Ù¯µ®[n<ìîúcoå©n\u0013"l]Ð',
            },
            chainKey: {
              counter: 5,
              key: 'Z{òÙ8Ø³AÝdSZk\nÃ\u001cô¡\u001b[YÒÂ¶\u0016a°\u0004<',
            },
            chainType: 2,
          },
          '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1': {
            messageKeys: {},
            chainKey: {
              counter: -1,
              key: "èB?7\u000f¯\u001e\u0010¨\u0007}:?¹\u0010$\\ë~ª\u0000gM0Õ'£\u0005",
            },
            chainType: 1,
          },
        },
        '\u0005BD¿Z\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M': {
          registrationId: 3432,
          currentRatchet: {
            rootKey:
              'Ë\u00035/üÚg\u0003Xeûú\u0010\u0000ü\u0002¶»o5\u001c­¥\u0004Ðÿ«',
            lastRemoteEphemeralKey:
              '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs',
            previousCounter: 2,
            ephemeralKeyPair: {
              privKey: 'äãÅ«ªàøí)á\u0005Á"sJM.¨¡\u0012r(N\f9Ô\b',
              pubKey: '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1',
            },
          },
          indexInfo: {
            remoteIdentityKey: '\u0005¨¨©üÏäúoá©êO¢çúxr»Æ¿r²GùiT@',
            closed: 1605579954962,
            baseKey: '\u0005BD¿Z\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M',
            baseKeyType: 2,
          },
          oldRatchetList: [],
          '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs': {
            messageKeys: {
              '2': 'Îgó¯2àvñX_õ\u0014Ç\u0000öl\u001f4J>ÐÏ{`-Ü5¦',
              '3': 'c¿<µâ¼Xµ!Ù¯µ®[n<ìîúcoå©n\u0013"l]Ð',
            },
            chainKey: {
              counter: 5,
              key: 'Z{òÙ8Ø³AÝdSZk\nÃ\u001cô¡\u001b[YÒÂ¶\u0016a°\u0004<',
            },
            chainType: 2,
          },
          '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1': {
            messageKeys: {},
            chainKey: {
              counter: -1,
              key: "èB?7\u000f¯\u001e\u0010¨\u0007}:?¹\u0010$\\ë~ª\u0000gM0Õ'£\u0005",
            },
            chainType: 1,
          },
        },
        '\u0005AN¿C\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M': {
          registrationId: 2312,
          currentRatchet: {
            rootKey:
              'Ë\u00035/üÚg\u0003Xeûú\u0010\u0000ü\u0002¶»o5\u001c­¥\u0004Ðÿ«',
            lastRemoteEphemeralKey:
              '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs',
            previousCounter: 2,
            ephemeralKeyPair: {
              privKey: 'äãÅ«ªàøí)á\u0005Á"sJM.¨¡\u0012r(N\f9Ô\b',
              pubKey: '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1',
            },
          },
          indexInfo: {
            remoteIdentityKey: '\u0005¨¨©üÏäúoá©êO¢çúxr»Æ¿r²GùiT@',
            closed: 1605580407000,
            baseKey: '\u0005AN¿C\u0000lÈ\nyª\u000eümB0\u0017j.Û£³-s\u0016Ä(O_M',
            baseKeyType: 2,
          },
          oldRatchetList: [],
          '\u0005\n7\u001cmTb!è\u000eÍ\u0007\u0016m4g³\u0005üIYê\b\u0011ÏÎPs': {
            messageKeys: {
              '1': 'Îgó¯2àvñX_õ\u0014Ç\u0000öl\u001f4J>ÐÏ{`-Ü5¦',
              '5': 'c¿<µâ¼Xµ!Ù¯µ®[n<ìîúcoå©n\u0013"l]Ð',
            },
            chainKey: {
              counter: 5,
              key: 'Z{òÙ8Ø³AÝdSZk\nÃ\u001cô¡\u001b[YÒÂ¶\u0016a°\u0004<',
            },
            chainType: 2,
          },
          '\u0005+\u00134«1\u0000\u0013l *ãKçnºÖó³íTS&{ù Í>1': {
            messageKeys: {},
            chainKey: {
              counter: -1,
              key: "èB?7\u000f¯\u001e\u0010¨\u0007}:?¹\u0010$\\ë~ª\u0000gM0Õ'£\u0005",
            },
            chainType: 1,
          },
        },
      },
      version: 'v1',
    };

    const expected = {
      currentSession: {
        sessionVersion: 3,
        localIdentityPublic: 'Baioqfzc/5JD6b+GNqapPouf6eHK7xr9ynLJHnvl+444',
        remoteIdentityPublic: 'BaioqfzP5JD6b+GNqepPouf6eHK7xr9ynLJHnvlpgVRA',
        rootKey: 'ywM1L/yc2ppnA1hl+/oQlwD8Ara7bzUcg5etpQTQ/6s=',
        previousCounter: 3,
        senderChain: {
          senderRatchetKey: 'BSsTNJarMQATbCAq40vnbrrW87PtVFOfJox7+SDNgj4x',
          senderRatchetKeyPrivate:
            '5JfjxauqiuD47SmI4QXBIoxzSk0uqKEScp0oTgw51Ag=',
          chainKey: {
            index: 0,
            key: '6EI/Nw+vHhCoB499OpM/kLkQJFzrfqoAZ00w1ZgnowU=',
          },
          messageKeys: [],
        },
        receiverChains: [
          {
            senderRatchetKey: 'BQo3HG1UhWIh6A7NBxZtNGezBZH8nElZjOqNCBHPzlBz',
            chainKey: {
              index: 6,
              key: 'Wnvy2TjYs0HdZFNahmsKw5cc9KEbW1nSwraDFmGwBDw=',
            },
            messageKeys: [
              {
                index: 1,
                cipherKey: 'xVreEbT7Vtrxs85JyGBj6Y+UWftQz4H72F5kWV4cxqM=',
                iv: 'TcRanSxZVWbuIq0xDRGnEw==',
                macKey: '5fW9aIKXhtwWp/5alNJUIXInZbztf2ywzQSpYrXoQ3A=',
              },
              {
                index: 5,
                cipherKey: 'A99HjM4pUugsQ5+2v48FGTGEhZPoW6wzW9MqSc11QQ4=',
                iv: 'bE8Ei2Rkaoz4SKRwdG4+tQ==',
                macKey: 'TOTdbAf0bCHOzcQ3lBaIm3yqmpEqvvldD0qTuDFmkAI=',
              },
            ],
          },
        ],
        remoteRegistrationId: 4243,
        localRegistrationId: 3554,
        aliceBaseKey: 'BVeHv5MAbMgKeaoO/G1CMBdqhC7bo7Mtc4EWxI0oT19N',
      },
      previousSessions: [
        {
          sessionVersion: 3,
          localIdentityPublic: 'Baioqfzc/5JD6b+GNqapPouf6eHK7xr9ynLJHnvl+444',
          remoteIdentityPublic: 'BaioqfzP5JD6b+GNqepPouf6eHK7xr9ynLJHnvlpgVRA',
          rootKey: 'ywM1L/yc2ppnA1hl+/oQlwD8Ara7bzUcg5etpQTQ/6s=',
          previousCounter: 3,
          senderChain: {
            senderRatchetKey: 'BSsTNJarMQATbCAq40vnbrrW87PtVFOfJox7+SDNgj4x',
            senderRatchetKeyPrivate:
              '5JfjxauqiuD47SmI4QXBIoxzSk0uqKEScp0oTgw51Ag=',
            chainKey: {
              index: 0,
              key: '6EI/Nw+vHhCoB499OpM/kLkQJFzrfqoAZ00w1ZgnowU=',
            },
            messageKeys: [],
          },
          receiverChains: [
            {
              senderRatchetKey: 'BQo3HG1UhWIh6A7NBxZtNGezBZH8nElZjOqNCBHPzlBz',
              chainKey: {
                index: 6,
                key: 'Wnvy2TjYs0HdZFNahmsKw5cc9KEbW1nSwraDFmGwBDw=',
              },
              messageKeys: [
                {
                  index: 2,
                  cipherKey: 'xVreEbT7Vtrxs85JyGBj6Y+UWftQz4H72F5kWV4cxqM=',
                  iv: 'TcRanSxZVWbuIq0xDRGnEw==',
                  macKey: '5fW9aIKXhtwWp/5alNJUIXInZbztf2ywzQSpYrXoQ3A=',
                },
                {
                  index: 6,
                  cipherKey: 'A99HjM4pUugsQ5+2v48FGTGEhZPoW6wzW9MqSc11QQ4=',
                  iv: 'bE8Ei2Rkaoz4SKRwdG4+tQ==',
                  macKey: 'TOTdbAf0bCHOzcQ3lBaIm3yqmpEqvvldD0qTuDFmkAI=',
                },
              ],
            },
          ],
          remoteRegistrationId: 2312,
          localRegistrationId: 3554,
          aliceBaseKey: 'BUFOv0MAbMgKeaoO/G1CMBdqhC7bo7Mtc4EWxI0oT19N',
        },
        {
          sessionVersion: 3,
          localIdentityPublic: 'Baioqfzc/5JD6b+GNqapPouf6eHK7xr9ynLJHnvl+444',
          remoteIdentityPublic: 'BaioqfzP5JD6b+GNqepPouf6eHK7xr9ynLJHnvlpgVRA',
          rootKey: 'ywM1L/yc2ppnA1hl+/oQlwD8Ara7bzUcg5etpQTQ/6s=',
          previousCounter: 3,
          senderChain: {
            senderRatchetKey: 'BSsTNJarMQATbCAq40vnbrrW87PtVFOfJox7+SDNgj4x',
            senderRatchetKeyPrivate:
              '5JfjxauqiuD47SmI4QXBIoxzSk0uqKEScp0oTgw51Ag=',
            chainKey: {
              index: 0,
              key: '6EI/Nw+vHhCoB499OpM/kLkQJFzrfqoAZ00w1ZgnowU=',
            },
            messageKeys: [],
          },
          receiverChains: [
            {
              senderRatchetKey: 'BQo3HG1UhWIh6A7NBxZtNGezBZH8nElZjOqNCBHPzlBz',
              chainKey: {
                index: 6,
                key: 'Wnvy2TjYs0HdZFNahmsKw5cc9KEbW1nSwraDFmGwBDw=',
              },
              messageKeys: [
                {
                  index: 3,
                  cipherKey: 'xVreEbT7Vtrxs85JyGBj6Y+UWftQz4H72F5kWV4cxqM=',
                  iv: 'TcRanSxZVWbuIq0xDRGnEw==',
                  macKey: '5fW9aIKXhtwWp/5alNJUIXInZbztf2ywzQSpYrXoQ3A=',
                },
                {
                  index: 4,
                  cipherKey: 'A99HjM4pUugsQ5+2v48FGTGEhZPoW6wzW9MqSc11QQ4=',
                  iv: 'bE8Ei2Rkaoz4SKRwdG4+tQ==',
                  macKey: 'TOTdbAf0bCHOzcQ3lBaIm3yqmpEqvvldD0qTuDFmkAI=',
                },
              ],
            },
          ],
          remoteRegistrationId: 3432,
          localRegistrationId: 3554,
          aliceBaseKey: 'BUJEv1oAbMgKeaoO/G1CMBdqhC7bo7Mtc4EWxI0oT19N',
        },
      ],
    };

    const recordCopy = getRecordCopy(record);

    const actual = sessionRecordToProtobuf(record, ourData);

    assert.deepEqual(expected, protoToJSON(actual));

    // We want to ensure that conversion doesn't modify incoming data
    assert.deepEqual(record, recordCopy);
  });

  it('Generates expected protobuf with just-initialized session', () => {
    const record: any = {
      sessions: {
        '\u00055>=eV¹\u0019Ûn¾¯#ß¶_=\u0013.Nî\u001a¥%-]ù_\n': {
          registrationId: 3188,
          currentRatchet: {
            rootKey: '\u001b16ÊæðÊ¨¾>}Ú©ÄH¸sNÓ:ÈF¹³QÖi',
            lastRemoteEphemeralKey:
              '\u0005KÆ\\û«\u0003Ñ\u0005ÚûU±iú\u0012iÃ\u0011]¼åUà\u001f¯òÉ~&\u0003',
            previousCounter: 0,
            ephemeralKeyPair: {
              privKey:
                " -&\t]$\u0015P\u001fù\u000e\u001c\u001e'y\u001eïËîEÑ+éaª± :wM",
              pubKey: '\u0005\u0014¦ç\u0002ò\u001aÆå\u001a{Ø1´ènnÇ(ÛK©8PË"h',
            },
          },
          indexInfo: {
            remoteIdentityKey: '\u0005\u0019Úä§\u0006×dâ°u§õ`EËTe%H¢!&Ù8cz*',
            closed: -1,
            baseKey: '\u00055>=eV¹\u0019Ûn¾¯#ß¶_=\u0013.Nî\u001a¥%-]ù_\n',
            baseKeyType: 1,
          },
          oldRatchetList: [],
          '\u0005\u0014¦ç\u0002ò\u001aÆå\u001a{Ø1´ènnÇ(ÛK©8PË"h': {
            messageKeys: {},
            chainKey: {
              counter: 0,
              key: '¶^Do/jî\u000fUè«ª\u0011xnõ\u0011Æò}Ðó*äÇÊÂ\u0000',
            },
            chainType: 1,
          },
          pendingPreKey: {
            signedKeyId: 2995,
            baseKey: '\u00055>=eV¹\u0019Ûn¾¯#ß¶_=\u0013.Nî\u001a¥%-]ù_\n',
            preKeyId: 386,
          },
        },
      },
      version: 'v1',
    };

    const expected = {
      currentSession: {
        aliceBaseKey: 'BTU+PWVWuRnbiW6+ja+XI9+2Xz0TLk7uGqUlhS1d+V8K',
        localIdentityPublic: 'Baioqfzc/5JD6b+GNqapPouf6eHK7xr9ynLJHnvl+444',
        localRegistrationId: 3554,
        pendingPreKey: {
          baseKey: 'BTU+PWVWuRnbiW6+ja+XI9+2Xz0TLk7uGqUlhS1d+V8K',
          preKeyId: 386,
          signedPreKeyId: 2995,
        },
        previousCounter: 1,
        receiverChains: [],
        remoteIdentityPublic: 'BRmB2uSNpwbXZJjisIh1p/VgRctUZSVIoiEm2ThjiHoq',
        remoteRegistrationId: 3188,
        rootKey: 'GzGfNozK5vDKqL4+fdqpiMRIuHNOndM6iMhGubNR1mk=',
        senderChain: {
          chainKey: {
            index: 1,
            key: 'tl5Eby9q7n8PVeiriKoRjHhu9Y0RxvJ90PMq5MfKwgA=',
          },
          messageKeys: [],
          senderRatchetKey: 'BRSm55wC8hrG5Rp7l9gxtOhugp5ulcco20upOFCPyyJo',
          senderRatchetKeyPrivate:
            'IC0mCV0kFVAf+Q4cHid5hR7vy+5F0SvpYYaqsSA6d00=',
        },
        sessionVersion: 3,
      },
      previousSessions: [],
    };

    const recordCopy = getRecordCopy(record);

    const actual = sessionRecordToProtobuf(record, ourData);

    assert.deepEqual(expected, protoToJSON(actual));

    // We want to ensure that conversion doesn't modify incoming data
    assert.deepEqual(record, recordCopy);
  });
});
