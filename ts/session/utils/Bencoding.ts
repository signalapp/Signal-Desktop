import { from_string, to_string } from 'libsodium-wrappers-sumo';
import { isArray, isEmpty, isNumber, isPlainObject, isString, toNumber } from 'lodash';
import { StringUtils } from '.';

const e = 'e'; // end of whatever was before
const l = 'l'; // list of values
const i = 'i'; // start of integer
const d = 'd'; // start of dictionary
const colon = ':';

const eCode = e.charCodeAt(0); // end of whatever was before
const lCode = l.charCodeAt(0); // list of values
const iCode = i.charCodeAt(0); // start of integer
const dCode = d.charCodeAt(0); // start of dictionary
const colonCode = colon.charCodeAt(0);

interface BencodeDictType {
  [key: string]: BencodeElementType;
}

type BencodeArrayType = Array<BencodeElementType>;

type BencodeElementType = number | string | BencodeDictType | BencodeArrayType;
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export class BDecode {
  private readonly content: Uint8Array;
  private currentParsingIndex = 0;
  private readonly parsedContent: BencodeElementType;

  constructor(content: Uint8Array | string) {
    this.content = isString(content) ? from_string(content) : content;
    this.parsedContent = this.parseContent();
  }

  public getParsedContent() {
    return this.parsedContent;
  }

  /**
   * Decode an int from a byte array starting with charCode of `i` and ending with charCode `e`
   */
  private parseInt(): number {
    if (this.currentParsingIndex >= this.content.length) {
      throw new Error('parseInt: out of bounds');
    }
    if (this.content[this.currentParsingIndex] !== iCode) {
      throw new Error('parseInt: not the start of an int');
    }

    this.currentParsingIndex++; // drop `i`
    const startIntStr = this.currentParsingIndex; // save the start of the int
    const nextEndSeparator = this.content.indexOf(eCode, this.currentParsingIndex);
    if (nextEndSeparator === -1) {
      throw new Error('parseInt: not an int to be parsed here: no end separator');
    }

    const parsed = toNumber(to_string(this.content.slice(startIntStr, nextEndSeparator)));

    if (!isFinite(parsed)) {
      throw new Error(`parseInt: could not parse number ${parsed}`);
    }
    this.currentParsingIndex = nextEndSeparator;
    this.currentParsingIndex++; // drop the 'e'

    return parsed;
  }

  private parseList(): BencodeArrayType {
    const parsed: BencodeArrayType = [];

    if (this.currentParsingIndex >= this.content.length) {
      throw new Error('parseList: out of bounds');
    }
    if (this.content[this.currentParsingIndex] !== lCode) {
      throw new Error('parseList: not the start of a list');
    }

    this.currentParsingIndex++; // drop `l`

    while (
      this.currentParsingIndex < this.content.length &&
      this.content[this.currentParsingIndex] !== eCode
    ) {
      parsed.push(this.parseBlock());
    }
    this.currentParsingIndex++; // drop the 'e'

    return parsed;
  }

  private parseDict() {
    const parsed: BencodeDictType = {};

    if (this.currentParsingIndex >= this.content.length) {
      throw new Error('parseDict: out of bounds');
    }
    if (this.content[this.currentParsingIndex] !== dCode) {
      throw new Error('parseDict: not the start of a dict');
    }

    this.currentParsingIndex++; // drop `d`

    while (
      this.currentParsingIndex < this.content.length &&
      this.content[this.currentParsingIndex] !== eCode
    ) {
      const key = this.parseString();
      const value = this.parseBlock();
      parsed[key] = value;
    }
    this.currentParsingIndex++; // drop the 'e'

    return parsed;
  }

  /**
   * Decode a string element from iterator assumed to have structure `length:data`
   */
  private parseString(): string {
    if (this.currentParsingIndex >= this.content.length) {
      throw new Error('parseString: out of bounds');
    }

    // this.currentParsingIndex++;
    const separatorIndex = this.content.indexOf(colonCode, this.currentParsingIndex);
    if (separatorIndex === -1) {
      throw new Error('parseString: cannot parse string without separator');
    }
    const strLength = toNumber(
      to_string(this.content.slice(this.currentParsingIndex, separatorIndex))
    );
    if (!isFinite(strLength)) {
      throw new Error('parseString: cannot parse string without length');
    }

    if (strLength === 0) {
      return '';
    }

    if (strLength > this.content.length - separatorIndex - 1) {
      throw new Error(
        'parseString: length is too long considering what we have left on this string'
      );
    }
    const strContent = this.content.slice(separatorIndex + 1, separatorIndex + 1 + strLength);
    this.currentParsingIndex = separatorIndex + 1 + strLength;
    return StringUtils.decode(strContent, 'utf8');
  }

  private parseContent() {
    return this.parseBlock();
  }

  private parseBlock() {
    let parsed: BencodeElementType;
    if (this.content.length < this.currentParsingIndex) {
      throw new Error('Out of bounds');
    }
    if (this.content[this.currentParsingIndex] === lCode) {
      parsed = this.parseList();
    } else if (this.content[this.currentParsingIndex] === dCode) {
      parsed = this.parseDict();
    } else if (this.content[this.currentParsingIndex] === iCode) {
      parsed = this.parseInt();
    } else if (NUMBERS.some(num => this.content[this.currentParsingIndex] === num.charCodeAt(0))) {
      parsed = this.parseString();
    } else {
      throw new Error(
        `parseBlock: Could not parse charCode at ${this.currentParsingIndex}: ${
          this.content[this.currentParsingIndex]
        }. Length: ${this.content.length}`
      );
    }

    return parsed;
  }
}

export class BEncode {
  private readonly input: BencodeElementType;

  private readonly bencodedContent: Uint8Array;

  constructor(content: BencodeElementType) {
    this.input = content;
    this.bencodedContent = this.encodeContent();
  }

  public getBencodedContent() {
    return this.bencodedContent;
  }

  private encodeItem(item: BencodeElementType): Uint8Array {
    if (isNumber(item) && isFinite(item)) {
      return from_string(`i${item}e`);
    }

    if (isNumber(item)) {
      throw new Error('encodeItem not finite number');
    }

    if (isString(item)) {
      const content = new Uint8Array(StringUtils.encode(item, 'utf8'));

      const contentLengthLength = `${content.length}`.length;
      const toReturn = new Uint8Array(content.length + 1 + contentLengthLength);

      toReturn.set(from_string(`${content.length}`));
      toReturn.set([colonCode], contentLengthLength);
      toReturn.set(content, contentLengthLength + 1);
      return toReturn;
    }

    if (isArray(item)) {
      let content = new Uint8Array();
      //tslint disable prefer-for-of
      for (let index = 0; index < item.length; index++) {
        const encodedItem = this.encodeItem(item[index]);
        const encodedItemLength = encodedItem.length;
        const existingContentLength = content.length;
        const newContent = new Uint8Array(existingContentLength + encodedItemLength);
        newContent.set(content);
        newContent.set(encodedItem, content.length);
        content = newContent;
      }
      const toReturn = new Uint8Array(content.length + 2);
      toReturn.set([lCode]);
      toReturn.set(content, 1);
      toReturn.set([eCode], content.length + 1);

      return toReturn;
    }

    if (isPlainObject(item)) {
      // bencoded objects keys must be sorted lexicographically
      const sortedKeys = Object.keys(item).sort();
      let content = new Uint8Array();

      sortedKeys.forEach(key => {
        const value = item[key];

        const encodedKey = this.encodeItem(key);
        const encodedValue = this.encodeItem(value);
        const newContent = new Uint8Array(content.length + encodedKey.length + encodedValue.length);
        newContent.set(content);
        newContent.set(encodedKey, content.length);
        newContent.set(encodedValue, content.length + encodedKey.length);
        content = newContent;
      });
      const toReturn = new Uint8Array(content.length + 2);
      toReturn.set([dCode]);
      toReturn.set(content, 1);
      toReturn.set([eCode], content.length + 1);

      return toReturn;
    }

    throw new Error(`encodeItem: unknown type to encode ${typeof item}`);
  }

  private encodeContent(): Uint8Array {
    if (!this.input || (isEmpty(this.input) && !isNumber(this.input))) {
      return new Uint8Array();
    }

    return this.encodeItem(this.input);
  }
}
