/* eslint-env node */
/* global window */

const FormData = require('form-data');
const got = require('got');

const BASE_URL = 'https://debuglogs.org';
const VERSION = window.getVersion();
const USER_AGENT = `Session ${VERSION}`;

// Workaround: Submitting `FormData` using native `FormData::submit` procedure
// as integration with `got` results in S3 error saying we haven’t set the
// `Content-Length` header:
// https://github.com/sindresorhus/got/pull/466
const submitFormData = (form, url) =>
  new Promise((resolve, reject) => {
    form.submit(url, (error, response) => {
      if (error) {
        return reject(error);
      }

      const { statusCode } = response;
      if (statusCode !== 204) {
        return reject(
          new Error(`Failed to upload to S3, got status ${statusCode}`)
        );
      }

      return resolve();
    });
  });

//      upload :: String -> Promise URL
exports.upload = async content => {
  const signedForm = await got.get(BASE_URL, {
    json: true,
    headers: {
      'user-agent': USER_AGENT,
    },
  });
  if (!signedForm.body) {
    throw new Error('Failed to retrieve token');
  }
  const { fields, url } = signedForm.body;

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

  // WORKAROUND: See comment on `submitFormData`:
  // await got.post(url, { body: form });
  await submitFormData(form, url);

  return `${BASE_URL}/${fields.key}`;
};
