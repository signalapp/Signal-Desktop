// tslint:disable: no-implicit-dependencies max-func-body-length no-unused-expression
import chai from 'chai';

import chaiAsPromised from 'chai-as-promised';
import { from_string } from 'libsodium-wrappers-sumo';
import { StringUtils } from '../../../../session/utils';
import { BDecode, BEncode } from '../../../../session/utils/Bencoding';
chai.use(chaiAsPromised as any);

const { expect } = chai;

describe('Bencoding: BDecode Utils', () => {
  describe('From a string', () => {
    describe('parseInt', () => {
      it('parse 12', () => {
        expect(new BDecode('i12e').getParsedContent()).to.equal(12);
      });

      it('parse 0', () => {
        expect(new BDecode('ie').getParsedContent()).to.equal(0);
      });

      it('parse 12232332', () => {
        expect(new BDecode('i12232332e').getParsedContent()).to.equal(12232332);
      });

      it('parse 12232332 even if extra characters', () => {
        expect(new BDecode('i12232332eoverflow.d').getParsedContent()).to.equal(12232332);
      });

      it('throws invalid start', () => {
        expect(() => new BDecode('d12232332e').getParsedContent()).to.throw();
      });

      it('throws invalid end', () => {
        expect(() => new BDecode('i12232332d').getParsedContent()).to.throw();
      });

      it('throws invalid integer', () => {
        expect(() => new BDecode('i1223233qw2e').getParsedContent()).to.throw();
      });
    });

    describe('parseString', () => {
      it('parse short string ', () => {
        expect(new BDecode('1:a').getParsedContent()).to.equal('a');
      });

      it('parse string with emojis ', () => {
        expect(new BDecode('8:🎃🥸').getParsedContent()).to.equal('🎃🥸');
        expect(new BDecode('26:❤️‍🔥❤️‍🔥').getParsedContent()).to.equal('❤️‍🔥❤️‍🔥');
      });

      it('parse non ascii string', () => {
        expect(new BDecode('48:転キハ連月ざれ地周りを報最こもろ').getParsedContent()).to.equal(
          '転キハ連月ざれ地周りを報最こもろ'
        );
      });

      it('parse longer string', () => {
        expect(
          new BDecode(
            "320:Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic"
          ).getParsedContent()
        ).to.equal(
          "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic"
        );
      });

      it('throw if no separator ', () => {
        expect(() => new BDecode('1aa').getParsedContent()).to.throw();
      });

      it('throw if first part is not a number ', () => {
        expect(() => new BDecode('1a1:aa').getParsedContent()).to.throw();
      });

      it('throw if length brings us way out of range ', () => {
        expect(() => new BDecode('322:aa').getParsedContent()).to.throw();
      });

      it('throw if length brings us just out of range ', () => {
        expect(() => new BDecode('3:aa').getParsedContent()).to.throw();
      });
    });
  });

  describe('parseDict', () => {
    it('parse single entry dict with string `d3:bar4:spame`', () => {
      expect(new BDecode('d3:bar4:spame').getParsedContent()).to.deep.equal({ bar: 'spam' });
    });

    it('parse single entry dict with multiple strings `d3:bar4:spam5:barre2:twe`', () => {
      expect(new BDecode('d3:bar4:spam5:barre2:twe').getParsedContent()).to.deep.equal({
        bar: 'spam',
        barre: 'tw',
      });
    });

    it('parse multiple entries dict and int', () => {
      expect(new BDecode('d3:bar4:spam3:fooi42ee').getParsedContent()).to.deep.equal({
        bar: 'spam',
        foo: 42,
      });
    });

    it('parse multiple entries with ints', () => {
      expect(new BDecode('d3:bari999e3:fooi42ee').getParsedContent()).to.deep.equal({
        bar: 999,
        foo: 42,
      });
    });

    it('parse single entry with emoji', () => {
      expect(new BDecode('d3:bar8:🎃🥸e').getParsedContent()).to.deep.equal({
        bar: '🎃🥸',
      });
    });
  });

  describe('parseList', () => {
    it('parse single entry', () => {
      expect(new BDecode('l4:spame').getParsedContent()).to.deep.equal(['spam']);
    });

    it('parse multiple entries ', () => {
      expect(new BDecode('l4:spam2:spe').getParsedContent()).to.deep.equal(['spam', 'sp']);
    });

    it('parse multiple entries witrh int and strings ', () => {
      expect(new BDecode('l4:spam2:spi42e2:42e').getParsedContent()).to.deep.equal([
        'spam',
        'sp',
        42,
        '42',
      ]);
    });

    it('parse list with dict included ', () => {
      expect(new BDecode('ld3:bari999e3:fooi42eee').getParsedContent()).to.deep.equal([
        {
          bar: 999,
          foo: 42,
        },
      ]);
    });

    it('parse list with mulitple dict included ', () => {
      expect(
        new BDecode('ld3:bari999e3:fooi42eed3:rabi111e3:offi2312eee').getParsedContent()
      ).to.deep.equal([
        {
          bar: 999,
          foo: 42,
        },
        {
          rab: 111,
          off: 2312,
        },
      ]);
    });

    it('parse dict with list included ', () => {
      expect(new BDecode('d2:dili42ei24e4:key7ee').getParsedContent()).to.deep.equal({
        di: [42, 24, 'key7'],
      });
    });

    it('parse dict with multiple lists included ', () => {
      expect(new BDecode('d2:dili42ei24e4:key7e4:secol4:key7ee').getParsedContent()).to.deep.equal({
        di: [42, 24, 'key7'],
        seco: ['key7'],
      });
    });
  });
});

describe('Bencoding: BEncode Utils', () => {
  it('encode single string', () => {
    expect(new BEncode('abcdef').getBencodedContent()).to.deep.equal(
      new Uint8Array(StringUtils.encode('6:abcdef', 'utf8'))
    );
  });

  it('encode single string emoji', () => {
    expect(new BEncode('🎃🥸').getBencodedContent()).to.deep.equal(
      new Uint8Array(StringUtils.encode('8:🎃🥸', 'utf8'))
    );
  });

  it('encode single int', () => {
    expect(new BEncode(12).getBencodedContent()).to.deep.equal(from_string('i12e'));
  });

  it('encode array with one int', () => {
    expect(new BEncode([12]).getBencodedContent()).to.deep.equal(from_string('li12ee'));
  });

  it('encode array with multiple int', () => {
    expect(new BEncode([12, 34, 5678]).getBencodedContent()).to.deep.equal(
      from_string('li12ei34ei5678ee')
    );
  });

  it('encode array with different types', () => {
    expect(new BEncode([12, '34', 5678]).getBencodedContent()).to.deep.equal(
      from_string('li12e2:34i5678ee')
    );
  });

  it('encode dict with one item', () => {
    expect(new BEncode({ dict: '123' }).getBencodedContent()).to.deep.equal(
      from_string('d4:dict3:123e')
    );
  });

  it('encode dict with several items', () => {
    expect(new BEncode({ dict: '123', dict2: '1234' }).getBencodedContent()).to.deep.equal(
      from_string('d4:dict3:1235:dict24:1234e')
    );
  });

  it('encode dict with several items with arrays', () => {
    expect(new BEncode({ dict1: [1, 2, 3], dict2: [4, 5, 6] }).getBencodedContent()).to.deep.equal(
      from_string('d5:dict1li1ei2ei3ee5:dict2li4ei5ei6eee')
    );
  });

  it('encode dict with several items but sort them', () => {
    expect(new BEncode({ dict2: 'second', dict1: 'first' }).getBencodedContent()).to.deep.equal(
      from_string('d5:dict15:first5:dict26:seconde')
    );
  });

  it('encode dict with array with dict', () => {
    expect(new BEncode({ dict: [{ a: 'b', c: 'd' }] }).getBencodedContent()).to.deep.equal(
      from_string('d4:dictld1:a1:b1:c1:deee')
    );
  });

  it('encode dict with array with dict with emojis', () => {
    expect(new BEncode({ dict: [{ a: 'b', c: '🎃🥸' }] }).getBencodedContent()).to.deep.equal(
      from_string('d4:dictld1:a1:b1:c8:🎃🥸eee')
    );
  });
});
