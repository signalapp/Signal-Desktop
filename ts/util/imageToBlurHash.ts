// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import loadImage from 'blueimp-load-image';
import { encode } from 'blurhash';

type Input = Parameters<typeof loadImage>[0];

const loadImageData = async (input: Input): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    loadImage(
      input,
      canvasOrError => {
        if (canvasOrError instanceof Event && canvasOrError.type === 'error') {
          const processError = new Error(
            'imageToBlurHash: Failed to process image',
            { cause: canvasOrError }
          );
          reject(processError);
          return;
        }

        if (!(canvasOrError instanceof HTMLCanvasElement)) {
          reject(new Error('imageToBlurHash: result is not a canvas'));
          return;
        }

        const context = canvasOrError.getContext('2d');
        if (!context) {
          reject(
            new Error(
              'imageToBlurHash: cannot get CanvasRenderingContext2D from canvas'
            )
          );
          return;
        }

        resolve(
          context.getImageData(0, 0, canvasOrError.width, canvasOrError.height)
        );
      },
      // Calculating the blurhash on large images is a long-running and
      // synchronous operation, so here we ensure the images are a reasonable
      // size before calculating the blurhash. iOS uses a max size of 200x200
      // and Android uses a max size of 1/16 the original size. 200x200 is
      // easier for us.
      { canvas: true, orientation: true, maxWidth: 200, maxHeight: 200 }
    );
  });
};

export const imageToBlurHash = async (input: Input): Promise<string> => {
  const { data, width, height } = await loadImageData(input);
  // 4 horizontal components and 3 vertical components
  return encode(data, width, height, 4, 3);
};
