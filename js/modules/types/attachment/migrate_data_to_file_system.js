const isArrayBuffer = require('lodash/isArrayBuffer');
const isFunction = require('lodash/isFunction');
const isUndefined = require('lodash/isUndefined');
const omit = require('lodash/omit');


// type Context :: {
//   writeAttachmentData :: ArrayBuffer -> Promise (IO Path)
// }
//
//      migrateDataToFileSystem :: Attachment ->
//                                 Context ->
//                                 Promise Attachment
exports.migrateDataToFileSystem = async (attachment, { writeAttachmentData } = {}) => {
  if (!isFunction(writeAttachmentData)) {
    throw new TypeError('`writeAttachmentData` must be a function');
  }

  const { data } = attachment;
  const hasData = !isUndefined(data);
  const shouldSkipSchemaUpgrade = !hasData;
  if (shouldSkipSchemaUpgrade) {
    console.log('WARNING: `attachment.data` is `undefined`');
    return attachment;
  }

  const isValidData = isArrayBuffer(data);
  if (!isValidData) {
    throw new TypeError('Expected `attachment.data` to be an array buffer;' +
      ` got: ${typeof attachment.data}`);
  }

  const path = await writeAttachmentData(data);

  const attachmentWithoutData = omit(
    Object.assign({}, attachment, { path }),
    ['data']
  );
  return attachmentWithoutData;
};
