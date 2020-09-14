import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { DropZone } from './DropZone';

storiesOf('Sticker Creator/elements', module).add('DropZone', () => {
  return <DropZone onDrop={action('onDrop')} />;
});
