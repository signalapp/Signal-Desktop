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
Dependencies are managed by [bower](bower.io). You'll need to install
node, npm, and bower to change them.

### Adding a bower component

Add the package to bower.json under 'dependencies' or

`bower install *package-name* --save`

Next update the "preen" config in bower.json with the list of files we will
actually use from the new package, e.g.:
```
  "preen": {
    "new-package": ["path/to/main.js", "directory/**/*.js"],
    ...
  }
```
Now, run `grunt` to delete unused package files and concatenate the
remaining javascript files into `js-deps/bower_components.js`. Note that
packages will be concatenated **in order** as specified in the preen
config.

Finally, stage and commit changes to bower.json, js-deps/bower_components.js,
and bower_components/. The latter should be limited to files we actually use.

Tests
=====
Please write tests! Our testing framework is mocha and our assertion library is
chai:

  * http://visionmedia.github.io/mocha/
  * http://chaijs.com/api/assert/

Tips/Tricks
===========
* Loading the `test.html` page may read, write or clear localStorage. To avoid
  having to choose between running tests and preserving your existing messages,
  keys, and other extension data, much of the test suite can be run by starting
  a local webserver in the repository root, e.g. `python -m SimpleHTTPServer`.
  You can then access the test page at `http://0.0.0.0:8000/test.html`.
