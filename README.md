TextSecure Chromium Implementation
==================================

This is very early stuff and exists primarily to get the crypto in place.
*This does not currently work, dont bother trying to use it seriously yet*

Getting Started with Development
================================

These steps are for **development only**.

* Clone the repo
* Open Chrome
* Go to chrome://extensions/
* Enable developer mode (checkbox on the top right)
* Click "Load unpacked extension..."
* Point to the repo's directory

Note that for development, the TextSecure staging environment uses a self-signed certificate, which Chrome will complain is insecure. So first visit <https://textsecure-service-staging.whispersystems.org/> in your browser and allow the certificate.

Now, in the extension's options, you can register for TextSecure:

* Select "Register" under "I'm new to TextSecure".
* Enter a real phone number (Google Voice numbers work too) and country combination and choose to send an SMS. You will receive a real SMS.
* Enter the verification code you received by SMS.

You should now be able to use the extension. If you need to reset your development environment, open a browser console within the extension options page (or inspect `background.html`) and execute `localStorage.clear()` to clear out the settings.

Dependencies
============

Dependencies are managed by [bower](bower.io) and built with
[grunt](gruntjs.com). To change them, you'll need to install node and npm, then
run `npm install` to install bower, grunt, and related plugins.

### Adding a bower component

Add the package name and version to bower.json under 'dependencies' or `bower
install package-name --save`

Next update the "preen" config in bower.json with the list of files we will
actually use from the new package, e.g.:
```
  "preen": {
    "package-name": [
      "path/to/main.js",
      "directory/**/*.js"
    ],
    ...
  }
```

Now, run `grunt` to delete unused package files and concatenate the remaining
javascript files into `js-deps/bower_components.js`. Note that packages will be
concatenated **in the order** that they are listed in the preen config.

Finally, stage and commit changes to bower.json, js-deps/bower_components.js,
and bower_components/. The latter should be limited to files we actually use.

Tests
=====
Please write tests! Our testing framework is
[mocha](http://visionmedia.github.io/mocha/) and our assertion library is
[chai](http://chaijs.com/api/assert/).

To run tests, open `test/index.html` in your browser. Note that

 * Some tests depend on the native client module. These will fail unless you
   load the test page from the `chrome-extension://` namespace (as opposed to
   the `file://` namespace or via a local webserver.
 * Some tests may read, write or clear localStorage. It is recommended that you
   create a Chrome user profile just for running tests to avoid clobbering any
   existing account and message data.
