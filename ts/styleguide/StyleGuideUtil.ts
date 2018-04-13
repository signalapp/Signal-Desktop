import moment from 'moment';
import qs from 'qs';

import React from 'react';
import ReactDOM from 'react-dom';
import {
  padStart,
  sample,
} from 'lodash';


// Helper components used in the Style Guide, exposed at 'util' in the global scope via
//   the 'context' option in react-styleguidist.

export { ConversationContext } from './ConversationContext';
export { BackboneWrapper } from '../components/utility/BackboneWrapper';

// Here we can make things inside Webpack available to Backbone views like preload.js.

import { Quote } from '../components/conversation/Quote';
import * as HTML from '../html';

// @ts-ignore
import MIME from '../../js/modules/types/mime';

// TypeScript wants two things when you import:
//   1) a normal typescript file
//   2) a javascript file with type definitions
// Anything else will raise an error, that it can't find the module. And so, we ignore...

// @ts-ignore
import gif from '../../fixtures/giphy-GVNvOUpeYmI7e.gif';
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

function makeObjectUrl(data: ArrayBuffer, contentType: string): string {
  const blob = new Blob([data], {
    type: contentType,
  });
  return URL.createObjectURL(blob);
}

const ourNumber = '+12025559999';

export {
  mp3,
  mp3ObjectUrl,
  gif,
  gifObjectUrl,
  mp4,
  mp4ObjectUrl,
  txt,
  txtObjectUrl,
  ourNumber,
};


// Required, or TypeScript complains about adding keys to window
const parent = window as any;

const query = window.location.search.replace(/^\?/, '');
const urlOptions = qs.parse(query);
const theme = urlOptions.theme || 'android';
const locale = urlOptions.locale || 'en';

// @ts-ignore
import localeMessages from '../../_locales/en/messages.json';

// @ts-ignore
import { setup } from '../../js/modules/i18n';

const i18n = setup(locale, localeMessages);

export {
  theme,
  locale,
  i18n,
};


parent.i18n = i18n;
parent.moment = moment;

parent.moment.updateLocale(locale, {
  relativeTime: {
    h: parent.i18n('timestamp_h'),
    m: parent.i18n('timestamp_m'),
    s: parent.i18n('timestamp_s'),
  },
});
parent.moment.locale(locale);

parent.React = React;
parent.ReactDOM = ReactDOM;

parent.Signal.HTML = HTML;
parent.Signal.Types.MIME = MIME;
parent.Signal.Components = {
  Quote,
};

parent.ConversationController._initialFetchComplete = true;
parent.ConversationController._initialPromise = Promise.resolve();


const COLORS = [
  'red',
  'pink',
  'purple',
  'deep_purple',
  'indigo',
  'blue',
  'light_blue',
  'cyan',
  'teal',
  'green',
  'light_green',
  'orange',
  'deep_orange',
  'amber',
  'blue_grey',
  'grey',
  'default',
];

const CONTACTS = COLORS.map((color, index) => {
  const title = `${sample(['Mr.', 'Mrs.', 'Ms.', 'Unknown'])} ${color}`;
  const key = sample(['name', 'profileName']) as string;
  const id = `+1202555${padStart(index.toString(), 4, '0')}`;

  const contact = {
    color,
    [key]: title,
    id,
    type: 'private',
  };

  return parent.ConversationController.dangerouslyCreateAndAdd(contact);
});

const me = parent.ConversationController.dangerouslyCreateAndAdd({
  id: ourNumber,
  name: 'Me!',
  type: 'private',
  color: 'light_blue',
});

export {
  COLORS,
  CONTACTS,
  me,
};

parent.textsecure.storage.user.getNumber = () => ourNumber;

// Telling Lodash to relinquish _ for use by underscore
// @ts-ignore
_.noConflict();
