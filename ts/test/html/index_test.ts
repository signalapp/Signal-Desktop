import 'mocha';
import { assert } from 'chai';

import * as HTML from '../../html';

interface Test {
  input: string;
  name: string;
  output?: string;
  outputHref?: string;
  outputLabel?: string;
  postText?: string;
  preText?: string;
  skipped?: boolean;
}

describe('HTML', () => {
  describe('linkText', () => {
    const TESTS: Array<Test> = [
      {
        name: 'square brackets',
        input: 'https://www.example.com/test.html?foo=bar&baz[qux]=quux',
        output: 'https://www.example.com/test.html?foo=bar&baz[qux]=quux',
      },
      {
        name: 'Chinese characters',
        input: 'https://zh.wikipedia.org/zh-hans/信号',
        output: 'https://zh.wikipedia.org/zh-hans/信号',
      },
      {
        name: 'Cyrillic characters',
        input: 'https://ru.wikipedia.org/wiki/Сигнал',
        output: 'https://ru.wikipedia.org/wiki/Сигнал',
      },
      {
        skipped: true,
        name: 'trailing exclamation points',
        input: 'https://en.wikipedia.org/wiki/Mother!',
        output: 'https://en.wikipedia.org/wiki/Mother!',
      },
      {
        name: 'single quotes',
        input: "https://www.example.com/this-couldn't-be-true",
        output: "https://www.example.com/this-couldn't-be-true",
      },
      {
        name: 'special characters before URL begins',
        preText: 'wink ;)',
        input: 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
        output: 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
      },
      {
        name: 'URLs without protocols',
        input: 'github.com',
        outputHref: 'http://github.com',
        outputLabel: 'github.com',
      },
    ];

    TESTS.forEach(test => {
      (test.skipped ? it.skip : it)(`should handle ${test.name}`, () => {
        const preText = test.preText || 'Hello ';
        const postText = test.postText || ' World!';
        const input: string = `${preText}${test.input}${postText}`;
        const expected: string = [
          preText,
          `<a href="${test.outputHref || test.output}" target="_blank">`,
          test.outputLabel || test.output,
          '</a>',
          postText,
        ].join('');

        const actual = HTML.linkText(input);
        assert.equal(actual, expected);
      });
    });
  });

  describe('render', () => {
    it('should preserve line breaks', () => {
      const input: string = 'Hello\n\n\nWorld!';
      const expected: string = 'Hello<br><br><br>World!';

      const actual = HTML.render(input);
      assert.equal(actual, expected);
    });

    it('should not escape HTML', () => {
      const input: string = "Hello\n<script>alert('evil');</script>World!";
      const expected: string = "Hello<br><script>alert('evil');</script>World!";

      const actual = HTML.render(input);
      assert.equal(actual, expected);
    });
  });
});
