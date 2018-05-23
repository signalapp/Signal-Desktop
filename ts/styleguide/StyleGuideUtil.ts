import React from 'react';
import ReactDOM from 'react-dom';
import { default as _, padStart, sample } from 'lodash';
import libphonenumber from 'google-libphonenumber';

import moment from 'moment';
import QueryString from 'qs';

export { _ };

// Helper components used in the Style Guide, exposed at 'util' in the global scope via
//   the 'context' option in react-styleguidist.

export { ConversationContext } from './ConversationContext';
export { BackboneWrapper } from '../components/utility/BackboneWrapper';

// @ts-ignore
import * as Signal from '../../js/modules/signal';
import { SignalService } from '../protobuf';

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

const ourNumber = '+12025559999';
const groupNumber = '+12025550099';

export {
  mp3,
  mp3ObjectUrl,
  gif,
  gifObjectUrl,
  mp4,
  mp4ObjectUrl,
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
  ourNumber,
  groupNumber,
};

// Required, or TypeScript complains about adding keys to window
const parent = window as any;

const query = window.location.search.replace(/^\?/, '');
const urlOptions = QueryString.parse(query);
const theme = urlOptions.theme || 'android';
const locale = urlOptions.locale || 'en';

// @ts-ignore
import localeMessages from '../../_locales/en/messages.json';

// @ts-ignore
import { setup } from '../../js/modules/i18n';
import fileSize from 'filesize';

const i18n = setup(locale, localeMessages);

parent.filesize = fileSize;

parent.i18n = i18n;
parent.React = React;
parent.ReactDOM = ReactDOM;
parent.moment = moment;

parent.moment.updateLocale(locale, {
  relativeTime: {
    h: parent.i18n('timestamp_h'),
    m: parent.i18n('timestamp_m'),
    s: parent.i18n('timestamp_s'),
  },
});
parent.moment.locale(locale);

export { theme, locale, i18n };

// Used by signal.js to set up code that deals with message attachments/avatars
const Attachments = {
  createAbsolutePathGetter: () => () => '/fake/path',
  createDeleter: () => async () => undefined,
  createReader: () => async () => new ArrayBuffer(10),
  createWriterForExisting: () => async () => '/fake/path',
  createWriterForNew: () => async () => ({
    data: new ArrayBuffer(10),
    path: '/fake/path',
  }),
  getPath: (path: string) => path,
};

parent.Signal = Signal.setup({
  Attachments,
  userDataPath: '/',
  // tslint:disable-next-line:no-backbone-get-set-outside-model
  getRegionCode: () => parent.storage.get('regionCode'),
});
parent.SignalService = SignalService;

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
  const title = `${sample(['Mr.', 'Mrs.', 'Ms.', 'Unknown'])} ${color} 🔥`;
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

const group = parent.ConversationController.dangerouslyCreateAndAdd({
  id: groupNumber,
  name: 'A place for sharing cats',
  type: 'group',
});

group.contactCollection.add(me);
group.contactCollection.add(CONTACTS[0]);
group.contactCollection.add(CONTACTS[1]);
group.contactCollection.add(CONTACTS[2]);

export { COLORS, CONTACTS, me, group };

parent.textsecure.storage.user.getNumber = () => ourNumber;
parent.textsecure.messaging = {
  getProfile: async (phoneNumber: string): Promise<boolean> => {
    if (parent.ConversationController.get(phoneNumber)) {
      return true;
    }

    throw new Error('User does not have Signal account');
  },
};

parent.libphonenumber = libphonenumber.PhoneNumberUtil.getInstance();
parent.libphonenumber.PhoneNumberFormat = libphonenumber.PhoneNumberFormat;

parent.storage.put('regionCode', 'US');

// Telling Lodash to relinquish _ for use by underscore
// @ts-ignore
_.noConflict();
