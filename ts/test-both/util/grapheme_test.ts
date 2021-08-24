// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getGraphemes, count } from '../../util/grapheme';

describe('grapheme utilities', () => {
  describe('getGraphemes', () => {
    it('returns extended graphemes in a string', () => {
      assert.deepEqual([...getGraphemes('')], []);
      assert.deepEqual([...getGraphemes('hello')], [...'hello']);
      assert.deepEqual(
        [...getGraphemes('Bokmål')],
        ['B', 'o', 'k', 'm', 'å', 'l']
      );

      assert.deepEqual([...getGraphemes('💩💩💩')], ['💩', '💩', '💩']);
      assert.deepEqual([...getGraphemes('👩‍❤️‍👩')], ['👩‍❤️‍👩']);
      assert.deepEqual([...getGraphemes('👌🏽👌🏾👌🏿')], ['👌🏽', '👌🏾', '👌🏿']);

      assert.deepEqual([...getGraphemes('L̷̳͔̲͝Ģ̵̮̯̤̩̙͍̬̟͉̹̘̹͍͈̮̦̰̣͟͝O̶̴̮̻̮̗͘͡!̴̷̟͓͓')], ['L̷̳͔̲͝', 'Ģ̵̮̯̤̩̙͍̬̟͉̹̘̹͍͈̮̦̰̣͟͝', 'O̶̴̮̻̮̗͘͡', '!̴̷̟͓͓']);
    });
  });

  describe('count', () => {
    it('returns the number of extended graphemes in a string (not necessarily the length)', () => {
      // These tests modified [from iOS][0].
      // [0]: https://github.com/signalapp/Signal-iOS/blob/800930110b0386a4c351716c001940a3e8fac942/Signal/test/util/DisplayableTextFilterTest.swift#L40-L71

      // Plain text
      assert.strictEqual(count(''), 0);
      assert.strictEqual(count('boring text'), 11);
      assert.strictEqual(count('Bokmål'), 6);

      // Emojis
      assert.strictEqual(count('💩💩💩'), 3);
      assert.strictEqual(count('👩‍❤️‍👩'), 1);
      assert.strictEqual(count('🇹🇹🌼🇹🇹🌼🇹🇹'), 5);
      assert.strictEqual(count('🇹🇹'), 1);
      assert.strictEqual(count('🇹🇹 '), 2);
      assert.strictEqual(count('👌🏽👌🏾👌🏿'), 3);
      assert.strictEqual(count('😍'), 1);
      assert.strictEqual(count('👩🏽'), 1);
      assert.strictEqual(count('👾🙇💁🙅🙆🙋🙎🙍'), 8);
      assert.strictEqual(count('🐵🙈🙉🙊'), 4);
      assert.strictEqual(count('❤️💔💌💕💞💓💗💖💘💝💟💜💛💚💙'), 15);
      assert.strictEqual(count('✋🏿💪🏿👐🏿🙌🏿👏🏿🙏🏿'), 6);
      assert.strictEqual(count('🚾🆒🆓🆕🆖🆗🆙🏧'), 8);
      assert.strictEqual(count('0️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣🔟'), 11);
      assert.strictEqual(count('🇺🇸🇷🇺🇦🇫🇦🇲'), 4);
      assert.strictEqual(count('🇺🇸🇷🇺🇸 🇦🇫🇦🇲🇸'), 7);
      assert.strictEqual(count('🇺🇸🇷🇺🇸🇦🇫🇦🇲'), 5);
      assert.strictEqual(count('🇺🇸🇷🇺🇸🇦'), 3);
      assert.strictEqual(count('１２３'), 3);

      // Normal diacritic usage
      assert.strictEqual(count('Příliš žluťoučký kůň úpěl ďábelské ódy.'), 39);

      // Excessive diacritics
      assert.strictEqual(count('Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘'), 5);
      assert.strictEqual(count('H҉̸̧͘͠A͢͞V̛̛I̴̸N͏̕͏G҉̵͜͏͢ ̧̧́T̶̛͘͡R̸̵̨̢̀O̷̡U͡҉B̶̛͢͞L̸̸͘͢͟É̸ ̸̛͘͏R͟È͠͞A̸͝Ḑ̕͘͜I̵͘҉͜͞N̷̡̢͠G̴͘͠ ͟͞T͏̢́͡È̀X̕҉̢̀T̢͠?̕͏̢͘͢'), 28);
      assert.strictEqual(count('L̷̳͔̲͝Ģ̵̮̯̤̩̙͍̬̟͉̹̘̹͍͈̮̦̰̣͟͝O̶̴̮̻̮̗͘͡!̴̷̟͓͓'), 4);
    });
  });
});
