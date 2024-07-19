import path from 'path';
import { readFileSync } from 'fs';
import type { Page } from 'playwright';

export type Options = {
  window: Page;
  selector: string;
  filePath: string;
  contentType: string;
};

export const dropFile = async (opts: Options): Promise<void> => {
  const { window } = opts;

  const dataTransfer = await window.evaluateHandle(
    args => {
      // Have to take care with `args` here because this runs in the browser.
      // So you can't supply a `Buffer` for example.
      const { filename, data, contentType } = args;

      const dt = new DataTransfer();
      dt.items.add(
        new File([new Uint8Array(data)], filename, {
          type: contentType,
        })
      );
      return dt;
    },
    {
      contentType: opts.contentType,
      filename: path.basename(opts.filePath),
      data: readFileSync(opts.filePath).toJSON().data,
    }
  ); // https://stackoverflow.com/questions/72383727/playwright-a-buffer-is-incorrectly-serialized-when-passing-it-to-page-evaluateh

  await window.dispatchEvent(opts.selector, 'drop', {
    dataTransfer,
  });
};
