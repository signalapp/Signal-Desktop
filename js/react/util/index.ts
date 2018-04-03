// Helper components used in the styleguide, exposed at 'util' in the global scope via the
//   context option in reaat-styleguidist.

export { MessageParents } from './MessageParents';
export { BackboneWrapper } from './BackboneWrapper';

// Here we can make things inside Webpack available to Backbone views like preload.js.

import React from 'react';
import ReactDOM from 'react-dom';

import { Message } from '../conversation/Message';
import { Reply } from '../conversation/Reply';

// Required, or TypeScript complains about adding keys to window
const parent = window as any;

parent.React = React;
parent.ReactDOM = ReactDOM;

const SignalReact = parent.Signal.React = parent.Signal.React || {};

SignalReact.Message = Message;
SignalReact.Reply = Reply;
