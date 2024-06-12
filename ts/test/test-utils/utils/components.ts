import { RenderResult, prettyDOM } from '@testing-library/react';
import { enableLogRedirect } from './stubbing';

const printHTMLElement = async (element: HTMLElement, name?: string) => {
  if (!window.log || !enableLogRedirect) {
    throw Error(
      'window.log is not defined. Have you turned on enableLogRedirect / called stubWindowLog() ?'
    );
  }

  return window.log.debug(`\nHTML Element${name ? ` (${name})` : ''}:\n${prettyDOM(element)}\n`);
};
const printRenderResult = async (result: RenderResult, name?: string) => {
  if (!window.log || !enableLogRedirect) {
    throw Error(
      'window.log is not defined. Have you turned on enableLogRedirect / called stubWindowLog() ?'
    );
  }

  return window.log.debug(
    `\nRender Result${name ? ` (${name})` : ''}:\n${prettyDOM(result.baseElement)}\n`
  );
};

export { printHTMLElement, printRenderResult };
