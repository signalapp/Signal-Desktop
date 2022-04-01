import { expect } from 'chai';
import { getEmojiSizeClass } from '../../../../util/emoji';

describe('getEmojiSizeClass', () => {
  describe('empty or null string', () => {
    it('undefined as string', () => {
      expect(getEmojiSizeClass(undefined as any)).to.be.equal('small', 'should have return small');
    });
    it('null as string', () => {
      expect(getEmojiSizeClass(null as any)).to.be.equal('small', 'should have return small');
    });

    it('empty string', () => {
      expect(getEmojiSizeClass('')).to.be.equal('small', 'should have return small');
    });
  });

  describe('with only characters not emojis of ascii/utf8', () => {
    it('string of ascii only', () => {
      expect(
        getEmojiSizeClass('The ASCII compatible UTF-8 encoding of ISO 10646 and Unicode')
      ).to.be.equal('small', 'should have return small');
    });

    it('string of utf8 with weird chars but no', () => {
      expect(getEmojiSizeClass('ASCII safety test: 1lI|, 0OD, 8B')).to.be.equal(
        'small',
        'should have return small'
      );
    });

    it('string of utf8 with weird chars', () => {
      // taken from https://www.w3.org/2001/06/utf-8-test/UTF-8-demo.html
      expect(
        getEmojiSizeClass('ASCII safety test: 1lI|, 0OD, 8B, γιγνώσκειν, ὦ ἄνδρες  დასასწრებად')
      ).to.be.equal('small', 'should have return small');
    });

    it('short string of utf8 with weird chars', () => {
      // taken from https://www.w3.org/2001/06/utf-8-test/UTF-8-demo.html
      expect(getEmojiSizeClass('დ')).to.be.equal('small', 'should have return small');
    });
  });

  describe('with string containing utf8 emojis', () => {
    describe('with string containing utf8 emojis and normal characters', () => {
      it('one emoji after a normal sentence', () => {
        expect(
          getEmojiSizeClass('The SMILING FACE WITH HORNS character (😈) is assigned')
        ).to.be.equal('small', 'should have return small');
      });

      it('multiple emoji after a normal sentence', () => {
        expect(
          getEmojiSizeClass('The SMILING FACE WITH HORNS character (😈) is assigned 😈 😈')
        ).to.be.equal('small', 'should have return small');
      });

      it('multiple emoji before a normal sentence', () => {
        expect(
          getEmojiSizeClass('😈 😈The SMILING FACE WITH HORNS character () is assigned')
        ).to.be.equal('small', 'should have return small');
      });

      it('one emoji with just a space after', () => {
        expect(getEmojiSizeClass('😈 ')).to.be.equal('jumbo', 'should have return jumbo');
      });

      it('one emoji with just a space before', () => {
        expect(getEmojiSizeClass(' 😈')).to.be.equal('jumbo', 'should have return jumbo');
      });

      it('one emoji with just a space before & after', () => {
        expect(getEmojiSizeClass(' 😈 ')).to.be.equal('jumbo', 'should have return jumbo');
      });
    });
    describe('with string containing only emojis ', () => {
      it('one emoji without other characters', () => {
        expect(getEmojiSizeClass('😈')).to.be.equal('jumbo', 'should have return jumbo');
      });

      it('two emoji without other characters', () => {
        expect(getEmojiSizeClass('😈😈')).to.be.equal('jumbo', 'should have return jumbo');
      });

      it('3 emoji without other characters', () => {
        expect(getEmojiSizeClass('😈😈😈')).to.be.equal('large', 'should have return large');
      });

      it('4 emoji without other characters', () => {
        expect(getEmojiSizeClass('😈😈😈😈')).to.be.equal('large', 'should have return large');
      });

      it('5 emoji without other characters', () => {
        expect(getEmojiSizeClass('😈😈😈😈😈')).to.be.equal('medium', 'should have return medium');
      });

      it('6 emoji without other characters', () => {
        expect(getEmojiSizeClass('😈😈😈😈😈😈')).to.be.equal(
          'medium',
          'should have return medium'
        );
      });

      it('7 emoji without other characters', () => {
        expect(getEmojiSizeClass('😈😈😈😈😈😈😈')).to.be.equal(
          'small',
          'should have return small'
        );
      });

      it('lots of emojis without other characters', () => {
        expect(
          getEmojiSizeClass(
            '😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈😈'
          )
        ).to.be.equal('small', 'should have return small');
      });

      it('lots of emojis without other characters except space', () => {
        expect(getEmojiSizeClass('😈😈😈😈😈😈😈😈😈😈😈 😈😈   😈😈    😈😈 ')).to.be.equal(
          'small',
          'should have return small'
        );
      });

      it('3 emojis without other characters except space', () => {
        expect(getEmojiSizeClass('😈 😈 😈 ')).to.be.equal('large', 'should have return small');
      });
    });
  });
});
