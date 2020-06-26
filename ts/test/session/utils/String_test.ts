import chai from 'chai';
import ByteBuffer from 'bytebuffer';

// Can't import type as StringUtils.Encoding
import { Encoding } from '../../../session/utils/String';
import { StringUtils } from '../../../session/utils/';

// tslint:disable-next-line: no-require-imports no-var-requires
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const { expect } = chai;

describe('String Utils', () => {

  describe('encode', () => {
    it('can encode to base64', async () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'base64');

      expect(encoded instanceof ArrayBuffer).to.equal(true, 'a buffer was not returned from `encode`');
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('can encode to hex', async () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'hex');

      expect(encoded instanceof ArrayBuffer).to.equal(true, 'a buffer was not returned from `encode`');
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('wont encode invalid hex', async () => {
      const testString = 'ZZZZZZZZZZ';
      const encoded = StringUtils.encode(testString, 'hex');

      expect(encoded.byteLength).to.equal(0);
    });

    it('can encode to binary', async () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'binary');

      expect(encoded instanceof ArrayBuffer).to.equal(true, 'a buffer was not returned from `encode`');
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('can encode to utf8', async () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'binary');

      expect(encoded instanceof ArrayBuffer).to.equal(true, 'a buffer was not returned from `encode`');
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('can encode empty string', async () => {
      const testString = '';
      expect(testString).to.have.length(0);

      const allEncodedings = ([
        'base64',
        'hex',
        'binary',
        'utf8',
      ] as Array<Encoding>).map(e => StringUtils.encode(testString, e));

      allEncodedings.forEach(encoded => {
        expect(encoded instanceof ArrayBuffer).to.equal(true, 'a buffer was not returned from `encode`');
        expect(encoded.byteLength).to.equal(0);
      });
    });

    it('can encode huge string', async () => {
      const testString = Array(Math.pow(2, 16)).fill('0').join('');

      const allEncodedings = ([
        'base64',
        'hex',
        'binary',
        'utf8',
      ] as Array<Encoding>).map(e => StringUtils.encode(testString, e));

      allEncodedings.forEach(encoded => {
        expect(encoded instanceof ArrayBuffer).to.equal(true, 'a buffer was not returned from `encode`');
        expect(encoded.byteLength).to.be.greaterThan(0);
      });
    });

    it("won't encode illegal string length in hex", async () => {
      const testString = 'A';
      const encode = () => StringUtils.encode(testString, 'hex');

      // Ensure string is odd length
      expect(testString.length % 2).to.equal(1);
      expect(encode).to.throw('Illegal str: Length not a multiple of 2');
    });

    it('can convert obscure string', async () => {
      const testString = '↓←¶ᶑᵶ⅑⏕→⅓‎ᵹ⅙ᵰᶎ⅔⅗↔‌ᶈ⅞⁯⸜ᶊ⁬ᵴᶉ↉⁭¥ᶖᶋᶃᶓ⏦ᵾᶂᶆ↕⸝ᶔᶐ⏔£⏙⅐⅒ᶌ⁁ᶘᶄᶒ⁪ᶸ⅘‏⁮⅚⅛ᶙᶇᶕᶀ↑ᵿ⏠ᶍᵯ⏖⏗⅜ᶚᶏ⁊‍ᶁᶗᵽ⁫ᵼ⅝⏘⅖⅕⏡';

      // Not valid hex format; try test the others
      const encodings = ([
        'base64',
        'binary',
        'utf8',
      ] as Array<Encoding>);

      encodings.forEach(encoding => {
        const encoded = StringUtils.encode(testString, encoding);
        expect(encoded instanceof ArrayBuffer).to.equal(true, `a buffer was not returned using encoding: '${encoding}'`);
        expect(encoded.byteLength).to.be.greaterThan(0);
      });
    });
  });

  describe('decode', () => {
    it('', async () => {
      //
    });
  });
});
