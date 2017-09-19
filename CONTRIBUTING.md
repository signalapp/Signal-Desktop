Contributor Guidelines
======================

## Advice for new contributors

Start small. The PRs most likely to be merged are the ones that make small,
easily reviewed changes with clear, and specific intentions. See below for more
[guidelines on pull requests](#pull-requests).

It's a good idea to gauge interest in your intended work by finding the current issue
for it or creating a new one yourself. You can use also that issue as a place to signal
your intentions and get feedback from the users most likely to appreciate your changes.

Once you've spent a little bit of time planning your solution, it's a good idea to go
back to the issue and talk about your approach. We'd be happy to provide feedback. [An
ounce of prevention, as they say!](https://www.goodreads.com/quotes/247269-an-ounce-of-prevention-is-worth-a-pound-of-cure)


## Developer Setup

First, you'll need [Node.js](https://nodejs.org/) installed. Anything 6.x or newer works
as of Summer 2017. You might consider a [version](https://github.com/creationix/nvm)
[manager](https://github.com/coreybutler/nvm-windows) to make this easier for yourself.

Then you need `git`, if you don't have that yet: https://git-scm.com/

And for the final step before we actually get started, you'll need build tools to install
the native modules used by the application. On Windows, it's easiest to open the [Command
Prompt (`cmd.exe`) as Administrator](https://technet.microsoft.com/en-us/library/cc947813(v=ws.10).aspx)
and run this:

```
npm install --global --production windows-build-tools
```

On OSX you can install the [XCode Command-line tools](http://osxdaily.com/2014/02/12/install-command-line-tools-mac-os-x/). On Linux you'll need to take a trip to your
favorite package manager. Python 2.x and GCC two key necessary components.

Now, run these commands in your preferred terminal in a good directory for development:

```
git clone https://github.com/WhisperSystems/Signal-Desktop.git
cd Signal-Desktop
npm install -g yarn    # (only if you don't already have yarn)
yarn install           # install and build dependencies (this will take a while)
yarn run start         # run!
```

## Setting up standalone

By default the application will connect to the **staging** servers, which means that you
**will not** be able to link it with your primary mobile device.

Fear not! You don't have to link the app with your phone. During setup in development
mode, you'll be presented with a 'Standalone' button which goes through the registration
process like you would on a phone. But you won't be linked to any other devices.


## The staging environment

Sadly, this default setup results in no contacts and no message history, an entirely
empty application. But you can use the information from your production install of Signal
Desktop to populate your testing application!

First, find your application data:
  - OSX: `~/Library/Application Support/Signal`
  - Linux: `~/.config/Signal`
  - Windows 10: `C:\Users\<YourName>\AppData\Roaming\Signal`

Now make a copy of this production data directory in the same place, and call it
`Signal-development`. Now start up the development version of the app as normal,
and you'll see all of your contacts and messages!

You'll notice a prompt to re-link, because your production credentials won't work on
staging. Click 'Relink', then 'Standalone', then verify the phone number and click
'Send SMS.'

Once you've entered the confirmation code sent to your phone, you are registered as a
standalone staging device with your normal phone number, and a copy of your production
message history and contact list.

Here's the catch: you can't message any of these contacts, since they haven't done the
same thing. Who can you message for testing?


## Additional storage profiles

What you need for proper testing is additional phone numbers, to register additional
standalone devices. You can get them via
[Twilio ($1/mo. per number + $0.0075 per SMS)](https://www.twilio.com/), or via
[Google Voice (one number per Google Account, free SMS)](https://voice.google.com/).

Once you have the additional numbers, you can setup additional storage profiles and switch
between them using the `NODE_APP_INSTANCE` environment variable.

For example, to create an 'alice' profile, put a file called `local-alice.json` in the
`config` directory:

```
{
  "storageProfile": "aliceProfile"
}
```

Then you can start up the application a little differently to load the profile:

```
NODE_APP_INSTANCE=alice yarn run start
```

This changes the [userData](https://electron.atom.io/docs/all/#appgetpathname)
directory from `%appData%/Signal` to `%appData%/Signal-aliceProfile`.


# Making changes

So you're in the process of preparing that pull request. Here's how to make that go
smoothly.


## Tests

Please write tests! Our testing framework is
[mocha](http://mochajs.org/) and our assertion library is
[chai](http://chaijs.com/api/assert/).

To run tests, you can run them from the command line with `grunt unit-tests` or in an
interactive session with `NODE_ENV=test yarn run start`.


## Pull requests

So you wanna make a pull request? Please observe the following guidelines.

 * Please do not submit pull requests for translation fixes. Anyone can update
   the translations in
   [Transifex](https://www.transifex.com/projects/p/signal-desktop).
 * Never use plain strings right in the source code - pull them from `messages.json`!
   You **only** need to modify the default locale
   [`_locales/en/messages.json`](_locales/en/messages.json). Other locales are generated
   automatically based on that file and then periodically uploaded to Transifex for
   translation.
 * [Rebase](https://nathanleclaire.com/blog/2014/09/14/dont-be-scared-of-git-rebase/) your
   changes on the latest `master` branch, resolving any conflicts.
   This ensures that your changes will merge cleanly when you open your PR.
 * Be sure to add and run tests!
 * Make sure the diff between our master and your branch contains only the
   minimal set of changes needed to implement your feature or bugfix. This will
   make it easier for the person reviewing your code to approve the changes.
   Please do not submit a PR with commented out code or unfinished features.
 * Avoid meaningless or too-granular commits. If your branch contains commits like
   the lines of "Oops, reverted this change" or "Just experimenting, will
   delete this later", please [squash or rebase those changes away](https://robots.thoughtbot.com/git-interactive-rebase-squash-amend-rewriting-history).
 * Don't have too few commits. If you have a complicated or long lived feature
   branch, it may make sense to break the changes up into logical atomic chunks
   to aid in the review process.
 * Provide a well written and nicely formatted commit message. See [this
   link](http://chris.beams.io/posts/git-commit/)
   for some tips on formatting. As far as content, try to include in your
   summary
     1. What you changed
     2. Why this change was made (including git issue # if appropriate)
     3. Any relevant technical details or motivations for your implementation
        choices that may be helpful to someone reviewing or auditing the commit
        history in the future. When in doubt, err on the side of a longer
        commit message.

Above all, spend some time with the repository. Follow the pull request template added to
your pull request description automatically. Take a look at recent approved pull requests,
see how they did things.


## Linking to a staging mobile device

Multiple standalone desktop devices are great for testing of a lot of scenarios. But a lot
of the Signal experience requires a primary mobile device: contact management,
synchronizing read and verification states among all linked devices, etc.

This presents a problem - even if you had another phone, the production versions of the
iOS and Android apps are locked to the production servers. To test all secenarios in
staging, your best bet is to pull down the development version of the iOS or Android app,
and register it with one of your extra phone numbers:

First, build Signal for Android or iOS from source, and point its TextSecure service URL to `textsecure-service-staging.whispersystems.org`:

**on Android:** Replace the `SIGNAL_URL` value in [build.gradle](https://github.com/WhisperSystems/Signal-Android/blob/master/build.gradle)

**on iOS:** Replace the `textSecureServerURL` value in `TSConstants.h`(located in the SignalServiceKit pod)

This task is 1% search and replace, 99% setting up your build environment. Instructions are available for both
the [Android](https://github.com/WhisperSystems/Signal-Android/blob/master/BUILDING.md)
and [iOS](https://github.com/WhisperSystems/Signal-iOS/blob/master/BUILDING.md) projects.

Then you can set up your development build of Signal Desktop as normal. If you've already
set up as a standalone install, you can switch by opening the DevTools (View -> Toggle
Developer Tools) and entering this into the Console and pressing enter: `window.owsDesktopApp.appView.openInstaller();`


## Changing to production

If you're completely sure that your changes will have no impact to the production servers,
you can connect your development build to the production server by putting a file called
`local-development.json` in the `config` directory that looks like this:

```
{
  "serverUrl": "https://textsecure-service.whispersystems.org",
  "cdnUrl": "https://cdn.signal.org"
}
```

**Beware:** Setting up standalone with your primary phone number when connected to the
production servers will _unregister_ your mobile device! All messages from your contacts
will go to your new development desktop app instead of your phone.


## Dependencies

**Note**: You probably won't end up doing this. Feel free to skip for now.

Dependencies are managed by [bower](http://bower.io) and built with
[grunt](http://gruntjs.com). To change them, you'll need to install node and
npm, then run `npm install` to install bower, grunt, and related plugins.

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
If you'd like to add the new dependency to js/components.js to be included on
all html pages, simply append the package name to the concat.app list in
`bower.json`. Take care to insert it in the order you would like it
concatenated.

Now, run `grunt` to delete unused package files and build `js/components.js`.

Finally, stage and commit changes to bower.json, `js/components.js`,
and `components/`. The latter should be limited to files we actually use.
