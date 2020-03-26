// @ts-ignore
import gif from '../../fixtures/giphy-GVNvOUpeYmI7e.gif';
// @ts-ignore
import png from '../../fixtures/freepngs-2cd43b_bed7d1327e88454487397574d87b64dc_mv2.png';
// @ts-ignore
import landscapeGreen from '../../fixtures/1000x50-green.jpeg';
// @ts-ignore
import landscapePurple from '../../fixtures/200x50-purple.png';

function makeObjectUrl(data: ArrayBuffer, contentType: string): string {
  const blob = new Blob([data], {
    type: contentType,
  });

  return URL.createObjectURL(blob);
}

// 320x240
export const gifObjectUrl = makeObjectUrl(gif, 'image/gif');

// 800×1200
export const pngObjectUrl = makeObjectUrl(png, 'image/png');
export const landscapeGreenObjectUrl = makeObjectUrl(
  landscapeGreen,
  'image/jpeg'
);
export const landscapePurpleObjectUrl = makeObjectUrl(
  landscapePurple,
  'image/png'
);
