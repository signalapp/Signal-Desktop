/* eslint-env node */
/* global window */

const FormData = require('form-data');
const insecureNodeFetch = require('node-fetch');

const BASE_URL = 'https://debuglogs.org';
const VERSION = window.getVersion();
const USER_AGENT = `Session ${VERSION}`;

//      upload :: String -> Promise URL
exports.upload = async content => {
  window.log.warn('insecureNodeFetch => upload debugLogs');
  const signedForm = await insecureNodeFetch(BASE_URL, {
    headers: {
      'user-agent': USER_AGENT,
    },
  });
  const json = await signedForm.json();
  if (!signedForm.ok || !json) {
    throw new Error('Failed to retrieve token');
  }
  const { fields, url } = json;

  const form = new FormData();
  // The API expects `key` to be the first field:
  form.append('key', fields.key);
  Object.entries(fields)
    .filter(([key]) => key !== 'key')
    .forEach(([key, value]) => {
      form.append(key, value);
    });

  const contentBuffer = Buffer.from(content, 'utf8');
  const contentType = 'text/plain';
  form.append('Content-Type', contentType);
  form.append('file', contentBuffer, {
    contentType,
    filename: `session-desktop-debug-log-${VERSION}.txt`,
  });

  const result = await insecureNodeFetch(url, {
    method: 'POST',
    body: form,
  });

  const { status } = result;
  if (status !== 204) {
    throw new Error(`Failed to upload to S3, got status ${status}`);
  }

  return `${BASE_URL}/${fields.key}`;
};
