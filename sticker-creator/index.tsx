import * as React from 'react';
import { render } from 'react-dom';
import { Root } from './root';

const root = document.getElementById('root');

console.log('Sticker Creator: Starting root');
render(<Root />, root);
