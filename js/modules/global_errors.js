const addUnhandledErrorHandler = require('electron-unhandled');

const Errors = require('./types/errors');


//      addHandler :: Unit -> Unit
exports.addHandler = () => {
  addUnhandledErrorHandler({
    logger: (error) => {
      console.error(
        'Uncaught error or unhandled promise rejection:',
        Errors.toLogFormat(error)
      );
    },
    showDialog: false,
  });
};
