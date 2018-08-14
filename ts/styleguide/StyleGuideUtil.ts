import QueryString from 'qs';
import classNames from 'classnames';

// This file provides helpers for the Style Guide, exposed at 'util' in the global scope
//   via the 'context' option in react-styleguidist.

import { default as _ } from 'lodash';
export { ConversationContext } from './ConversationContext';

export { _, classNames };

// TypeScript wants two things when you import:
//   1) a normal typescript file
//   2) a javascript file with type definitions
// Anything else will raise an error, that it can't find the module. And so, we ignore...

// @ts-ignore
import gif from '../../fixtures/giphy-GVNvOUpeYmI7e.gif';
// 320x240
const gifObjectUrl = makeObjectUrl(gif, 'image/gif');
// @ts-ignore
import mp3 from '../../fixtures/incompetech-com-Agnus-Dei-X.mp3';
const mp3ObjectUrl = makeObjectUrl(mp3, 'audio/mp3');
// @ts-ignore
import txt from '../../fixtures/lorem-ipsum.txt';
const txtObjectUrl = makeObjectUrl(txt, 'text/plain');
// @ts-ignore
import mp4 from '../../fixtures/pixabay-Soap-Bubble-7141.mp4';
const mp4ObjectUrl = makeObjectUrl(mp4, 'video/mp4');
// @ts-ignore
import png from '../../fixtures/freepngs-2cd43b_bed7d1327e88454487397574d87b64dc_mv2.png';
// 800×1200
const pngObjectUrl = makeObjectUrl(png, 'image/png');

// @ts-ignore
import landscapeGreen from '../../fixtures/1000x50-green.jpeg';
const landscapeGreenObjectUrl = makeObjectUrl(landscapeGreen, 'image/jpeg');
// @ts-ignore
import landscapePurple from '../../fixtures/200x50-purple.png';
const landscapePurpleObjectUrl = makeObjectUrl(landscapePurple, 'image/png');
// @ts-ignore
import portraitYellow from '../../fixtures/20x200-yellow.png';
const portraitYellowObjectUrl = makeObjectUrl(portraitYellow, 'image/png');
// @ts-ignore
import landscapeRed from '../../fixtures/300x1-red.jpeg';
const landscapeRedObjectUrl = makeObjectUrl(landscapeRed, 'image/png');
// @ts-ignore
import portraitTeal from '../../fixtures/50x1000-teal.jpeg';
const portraitTealObjectUrl = makeObjectUrl(portraitTeal, 'image/png');

function makeObjectUrl(data: ArrayBuffer, contentType: string): string {
  const blob = new Blob([data], {
    type: contentType,
  });

  return URL.createObjectURL(blob);
}

export {
  mp3,
  mp3ObjectUrl,
  gif,
  gifObjectUrl,
  mp4,
  mp4ObjectUrl,
  png,
  pngObjectUrl,
  txt,
  txtObjectUrl,
  landscapeGreen,
  landscapeGreenObjectUrl,
  landscapePurple,
  landscapePurpleObjectUrl,
  portraitYellow,
  portraitYellowObjectUrl,
  landscapeRed,
  landscapeRedObjectUrl,
  portraitTeal,
  portraitTealObjectUrl,
};

const query = window.location.search.replace(/^\?/, '');
const urlOptions = QueryString.parse(query);
const theme = urlOptions.theme || 'light-theme';
const ios = urlOptions.ios || false;
const locale = urlOptions.locale || 'en';

// @ts-ignore
import localeMessages from '../../_locales/en/messages.json';

// @ts-ignore
import { setup } from '../../js/modules/i18n';
const i18n = setup(locale, localeMessages);

export { theme, ios, locale, i18n };

// Telling Lodash to relinquish _ for use by underscore
// @ts-ignore
_.noConflict();
