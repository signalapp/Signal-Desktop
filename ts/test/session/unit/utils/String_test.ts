/* eslint-disable no-unused-expressions */
import ByteBuffer from 'bytebuffer';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

// Can't import type as StringUtils.Encoding
import { StringUtils } from '../../../../session/utils';
import { Encoding } from '../../../../session/utils/String';

chai.use(chaiAsPromised as any);

const { expect } = chai;

describe('String Utils', () => {
  describe('encode', () => {
    it('can encode to base64', () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'base64');

      expect(encoded instanceof ArrayBuffer).to.equal(
        true,
        'a buffer was not returned from `encode`'
      );
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('can encode to hex', () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'hex');

      expect(encoded instanceof ArrayBuffer).to.equal(
        true,
        'a buffer was not returned from `encode`'
      );
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('wont encode invalid hex', () => {
      const testString = 'ZZZZZZZZZZ';
      const encoded = StringUtils.encode(testString, 'hex');

      expect(encoded.byteLength).to.equal(0);
    });

    it('can encode to binary', () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'binary');

      expect(encoded instanceof ArrayBuffer).to.equal(
        true,
        'a buffer was not returned from `encode`'
      );
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('can encode to utf8', () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'binary');

      expect(encoded instanceof ArrayBuffer).to.equal(
        true,
        'a buffer was not returned from `encode`'
      );
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('can encode empty string', () => {
      const testString = '';
      expect(testString).to.have.length(0);

      const allEncodedings = (['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>).map(e =>
        StringUtils.encode(testString, e)
      );

      allEncodedings.forEach(encoded => {
        expect(encoded instanceof ArrayBuffer).to.equal(
          true,
          'a buffer was not returned from `encode`'
        );
        expect(encoded.byteLength).to.equal(0);
      });
    });

    it('can encode huge string', () => {
      const stringSize = 2 ** 16;
      const testString = Array(stringSize).fill('0').join('');

      const allEncodedings = (['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>).map(e =>
        StringUtils.encode(testString, e)
      );

      allEncodedings.forEach(encoded => {
        expect(encoded instanceof ArrayBuffer).to.equal(
          true,
          'a buffer was not returned from `encode`'
        );
        expect(encoded.byteLength).to.be.greaterThan(0);
      });
    });

    it("won't encode illegal string length in hex", () => {
      const testString = 'A';
      const encode = () => StringUtils.encode(testString, 'hex');

      // Ensure string is odd length
      expect(testString.length % 2).to.equal(1);
      expect(encode).to.throw('Illegal str: Length not a multiple of 2');
    });

    it('can encode obscure string', () => {
      const testString =
        '↓←¶ᶑᵶ⅑⏕→⅓‎ᵹ⅙ᵰᶎ⅔⅗↔‌ᶈ⅞⁯⸜ᶊ⁬ᵴᶉ↉⁭¥ᶖᶋᶃᶓ⏦ᵾᶂᶆ↕⸝ᶔᶐ⏔£⏙⅐⅒ᶌ⁁ᶘᶄᶒ⁪ᶸ⅘‏⁮⅚⅛ᶙᶇᶕᶀ↑ᵿ⏠ᶍᵯ⏖⏗⅜ᶚᶏ⁊‍ᶁᶗᵽ⁫ᵼ⅝⏘⅖⅕⏡';

      // Not valid hex format; try test the others
      const encodings = ['base64', 'binary', 'utf8'] as Array<Encoding>;

      encodings.forEach(encoding => {
        const encoded = StringUtils.encode(testString, encoding);
        expect(encoded instanceof ArrayBuffer).to.equal(
          true,
          `a buffer was not returned using encoding: '${encoding}'`
        );
        expect(encoded.byteLength).to.be.greaterThan(0);
      });
    });
  });

  describe('decode', () => {
    it('can decode empty buffer', () => {
      const buffer = new ByteBuffer(0);

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length(0);
      });
    });

    it('can decode huge buffer', () => {
      const bytes = 2 ** 16;
      const bufferString = Array(bytes).fill('A').join('');
      const buffer = ByteBuffer.fromUTF8(bufferString);

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length.greaterThan(0);
      });
    });

    it('can decode from ByteBuffer', () => {
      const buffer = ByteBuffer.fromUTF8('AAAAAAAAAA');

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length.greaterThan(0);
      });
    });

    it('can decode from Buffer', () => {
      const arrayBuffer = new ArrayBuffer(10);
      const buffer = Buffer.from(arrayBuffer);
      buffer.writeUInt8(0, 0);

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length.greaterThan(0);
      });
    });

    it('can decode from ArrayBuffer', () => {
      const buffer = new ArrayBuffer(10);

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length.greaterThan(0);
      });
    });

    it('can decode from Uint8Array', () => {
      const buffer = new Uint8Array(10);

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length.greaterThan(0);
      });
    });
  });

  describe('sanitizeSessionUsername', () => {
    it('should remove invalid characters', () => {
      const invalidChars = ['\uFFD2', '\uFFD2\uFFD2', '\uFFD2\uFFD2\uFFD2'];

      invalidChars.forEach(invalidChar => {
        const validUsername = StringUtils.sanitizeSessionUsername(invalidChar);
        expect(
          validUsername,
          'should return an empty string if there are no valid characters'
        ).to.equal('');
      });
    });

    it('should not remove valid characters', () => {
      const validChars = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

      validChars.forEach(validChar => {
        const validUsername = StringUtils.sanitizeSessionUsername(validChar);
        expect(validUsername).to.equal(validChar);
      });
    });

    it('should remove invalid characters and keep valid characters', () => {
      const input = 'a\uFFD2b\uFFD2c\uFFD2d\uFFD2e\uFFD2f\uFFD2g\uFFD2h\uFFD2i\uFFD2j';
      const expected = 'abcdefghij';
      const validUsername = StringUtils.sanitizeSessionUsername(input);
      expect(validUsername).to.equal(expected);
    });

    it('should remove invalid characters and keep valid characters with spaces', () => {
      const input = 'a\uFFD2 b\uFFD2 c\uFFD2 d\uFFD2 e\uFFD2 f\uFFD2 g\uFFD2 h\uFFD2 i\uFFD2 j';
      const expected = 'a b c d e f g h i j';
      const validUsername = StringUtils.sanitizeSessionUsername(input);
      expect(validUsername).to.equal(expected);
    });

    it('should remove invalid characters and keep valid characters with spaces and special characters', () => {
      const input =
        'a\uFFD2 b\uFFD2 c\uFFD2 d\uFFD2 e\uFFD2 f\uFFD2 g\uFFD2 h\uFFD2 i\uFFD2 j\uFFD2 !@#$%^&*()_+';
      const expected = 'a b c d e f g h i j !@#$%^&*()_+';
      const validUsername = StringUtils.sanitizeSessionUsername(input);
      expect(validUsername).to.equal(expected);
    });
  });
});
