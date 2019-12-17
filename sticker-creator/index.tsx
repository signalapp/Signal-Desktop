import * as React from 'react';
import { render } from 'react-dom';
import { Root } from './root';
import { preloadImages } from '../ts/components/emoji/lib';

const root = document.getElementById('root');

render(<Root />, root);

preloadImages();
