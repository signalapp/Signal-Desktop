import { RenderResult } from '@testing-library/react';
import * as prettier from 'prettier';
import { enableLogRedirect } from './stubbing';

const printHTMLElement = async (element: HTMLElement) => {
  if (!window.log || !enableLogRedirect) {
    throw Error('window.log is not defined. Have you turned on enableLogRedirect?');
  }

  return window.log.debug(
    `\nRender Result:\n${await prettier.format(element.outerHTML, { parser: 'html' })}\n`
  );
};
const printRenderResult = async (result: RenderResult) => {
  if (!window.log || !enableLogRedirect) {
    throw Error('window.log is not defined. Have you turned on enableLogRedirect?');
  }

  return window.log.debug(
    `\nHTML Element:\n${await prettier.format(result.baseElement.outerHTML, { parser: 'html' })}\n`
  );
};

export { printHTMLElement, printRenderResult };
