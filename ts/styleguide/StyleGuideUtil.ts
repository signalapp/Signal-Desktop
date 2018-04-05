import moment from 'moment';
import qs from 'qs';

import React from 'react';
import ReactDOM from 'react-dom';


// Helper components used in the Style Guide, exposed at 'util' in the global scope via
//   the 'context' option in react-styleguidist.

export { ConversationContext } from './ConversationContext';
export { BackboneWrapper } from '../components/utility/BackboneWrapper';

// Here we can make things inside Webpack available to Backbone views like preload.js.

import { Message } from '../components/conversation/Message';
import { Reply } from '../components/conversation/Reply';


// TypeScript wants two things when you import:
//   1) a normal typescript file
//   2) a javascript file with type definitions
// Anything else will raise an error, that it can't find the module. And so, we ignore...

// @ts-ignore
import gif from '../../fixtures/giphy-GVNvOUpeYmI7e.gif';
// @ts-ignore
import mp3 from '../../fixtures/incompetech-com-Agnus-Dei-X.mp3';
// @ts-ignore
import txt from '../../fixtures/lorem-ipsum.txt';
// @ts-ignore
import mp4 from '../../fixtures/pixabay-Soap-Bubble-7141.mp4';

export {
  mp3,
  gif,
  mp4,
  txt,
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

parent.Signal.Components = {
  Message,
  Reply,
};

parent.ConversationController._initialFetchComplete = true;
parent.ConversationController._initialPromise = Promise.resolve();
