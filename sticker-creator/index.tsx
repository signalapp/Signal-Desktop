import * as React from 'react';
import { render } from 'react-dom';
import { Root } from './root';

const root = document.getElementById('root');

// eslint-disable-next-line no-console
console.log('Sticker Creator: Starting root');
render(<Root />, root);
