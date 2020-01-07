import * as React from 'react';
import { DropZone } from './DropZone';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

storiesOf('Sticker Creator/elements', module).add('DropZone', () => {
  return <DropZone onDrop={action('onDrop')} />;
});
