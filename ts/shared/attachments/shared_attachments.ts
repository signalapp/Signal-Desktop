//      createDeleter :: AttachmentsPath ->
//                       RelativePath ->
//                       IO Unit

import path from 'path';
import { isString } from 'lodash';
import fse from 'fs-extra';

export const createDeleter = (root: string) => {
  if (!isString(root)) {
    throw new TypeError("'root' must be a path");
  }

  return async (relativePath: string) => {
    if (!isString(relativePath)) {
      throw new TypeError("'relativePath' must be a string");
    }

    const absolutePath = path.join(root, relativePath);
    const normalized = path.normalize(absolutePath);
    if (!normalized.startsWith(root)) {
      throw new Error('Invalid relative path');
    }
    await fse.remove(absolutePath);
  };
};

const PATH = 'attachments.noindex';

//      getPath :: AbsolutePath -> AbsolutePath
export const getAttachmentsPath = (userDataPath: string) => {
  if (!isString(userDataPath)) {
    throw new TypeError("'userDataPath' must be a string");
  }
  return path.join(userDataPath, PATH);
};
