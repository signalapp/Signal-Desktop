import { expect } from 'chai';
import { getInitials } from '../../../../util/getInitials';

describe('getInitials', () => {
  describe('empty or null string', () => {
    it('initials: return undefined if string is undefined', () => {
      expect(getInitials(undefined)).to.be.equal('0', 'should have return 0');
    });

    it('initials: return undefined if string is empty', () => {
      expect(getInitials('')).to.be.equal('0', 'should have return 0');
    });

    it('initials: return undefined if string is null', () => {
      expect(getInitials(null as any)).to.be.equal('0', 'should have return 0');
    });
  });

  describe('name is a pubkey', () => {
    it('initials: return the first char after 05 if it starts with 05 and has length >2 ', () => {
      expect(getInitials('052')).to.be.equal('2', 'should have return 2');
    });

    it('initials: return the first char after 05 capitalized if it starts with 05 and has length >2 ', () => {
      expect(getInitials('05bcd')).to.be.equal('B', 'should have return B');
    });

    it('initials: return the first char after 05 if it starts with 05 and has length >2 ', () => {
      expect(getInitials('059052052052052052052052')).to.be.equal('9', 'should have return 9');
    });
  });

  describe('name has a space in its content', () => {
    it('initials: return the first char of each first 2 words if a space is present ', () => {
      expect(getInitials('John Doe')).to.be.equal('JD', 'should have return JD');
    });

    it('initials: return the first char capitalized of each first 2 words if a space is present ', () => {
      expect(getInitials('John doe')).to.be.equal('JD', 'should have return JD capitalized');
    });

    it('initials: return the first char capitalized of each first 2 words if a space is present, even with more than 2 words ', () => {
      expect(getInitials('John Doe Alice')).to.be.equal('JD', 'should have return JD capitalized');
    });

    it('initials: return the first char capitalized of each first 2 words if a space is present, even with more than 2 words ', () => {
      expect(getInitials('John doe Alice')).to.be.equal('JD', 'should have return JD capitalized');
    });

    describe('name is not ascii', () => {
      // ß maps to  SS in uppercase
      it('initials: shorten to 2 char at most if the uppercase form length is > 2 ', () => {
        expect(getInitials('John ß')).to.be.equal('JS', 'should have return JS capitalized');
      });

      it('initials: shorten to 2 char at most if the uppercase form length is > 2 ', () => {
        expect(getInitials('ß ß')).to.be.equal('SS', 'should have return SS capitalized');
      });
    });
  });

  describe('name has a - in its content', () => {
    it('initials: return the first char of each first 2 words if a - is present ', () => {
      expect(getInitials('John-Doe')).to.be.equal('JD', 'should have return JD');
    });

    it('initials: return the first char capitalized of each first 2 words if a - is present ', () => {
      expect(getInitials('John-doe')).to.be.equal('JD', 'should have return JD capitalized');
    });

    it('initials: return the first char capitalized of each first 2 words if a - is present, even with more than 2 words ', () => {
      expect(getInitials('John-Doe-Alice')).to.be.equal('JD', 'should have return JD capitalized');
    });

    it('initials: return the first char capitalized of each first 2 words if a - is present, even with more than 2 words ', () => {
      expect(getInitials('John-doe-Alice')).to.be.equal('JD', 'should have return JD capitalized');
    });

    describe('name is not ascii', () => {
      // ß maps to  SS in uppercase
      it('initials: shorten to 2 char at most if the uppercase form length is > 2 ', () => {
        expect(getInitials('John-ß')).to.be.equal('JS', 'should have return JS capitalized');
      });

      it('initials: shorten to 2 char at most if the uppercase form length is > 2 ', () => {
        expect(getInitials('ß-ß')).to.be.equal('SS', 'should have return SS capitalized');
      });
    });
  });

  describe('name has NO spaces in its content', () => {
    it('initials: return the first 2 chars of the first word if the name has no space ', () => {
      expect(getInitials('JOHNY')).to.be.equal('JO', 'should have return JO');
    });

    it('initials: return the first 2 chars capitalized of the first word if the name has no space ', () => {
      expect(getInitials('Johnny')).to.be.equal('JO', 'should have return JO');
    });

    describe('name is not ascii', () => {
      // ß maps to  SS in uppercase
      it('initials: shorten to 2 char at most if the uppercase form length is > 2 ', () => {
        expect(getInitials('ß')).to.be.equal('SS', 'should have return SS capitalized');
      });

      it('initials: shorten to 2 char at most if the uppercase form length is > 2 ', () => {
        expect(getInitials('ßß')).to.be.equal('SS', 'should have return SS capitalized');
      });
    });
  });
});
