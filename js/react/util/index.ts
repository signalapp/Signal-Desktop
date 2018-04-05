// Helper components used in the styleguide, exposed at 'util' in the global scope via the
//   context option in reaat-styleguidist.

export { MessageParents } from './MessageParents';
export { BackboneWrapper } from './BackboneWrapper';

// Here we can make things inside Webpack available to Backbone views like preload.js.

import React from 'react';
import ReactDOM from 'react-dom';

import { Message } from '../conversation/Message';
import { Reply } from '../conversation/Reply';


// TypeScript wants two things when you import:
//   1) a normal typescript file
//   2) a javascript file with type definiitions
// Anything else will raise an error, that it can't find the module. And so, we ignore...

// @ts-ignore
import gif from '../../../fixtures/giphy-GVNvOUpeYmI7e.gif';
// @ts-ignore
import mp3 from '../../../fixtures/incompetech-com-Agnus-Dei-X.mp3';
// @ts-ignore
import txt from '../../../fixtures/lorem-ipsum.txt';
// @ts-ignore
import mp4 from '../../../fixtures/pixabay-Soap-Bubble-7141.mp4';

export {
  mp3,
  gif,
  mp4,
  txt,
};


// Required, or TypeScript complains about adding keys to window
const parent = window as any;

parent.React = React;
parent.ReactDOM = ReactDOM;

const SignalReact = parent.Signal.React = parent.Signal.React || {};

SignalReact.Message = Message;
SignalReact.Reply = Reply;
