import path from 'path';

import { app } from 'electron';

import { start } from './base_config';

const userDataPath = app.getPath('userData');
const targetPath = path.join(userDataPath, 'ephemeral.json');

export const ephemeralConfig = start('ephemeral', targetPath, {
  allowMalformedOnStartup: true,
});
