# Contributor Guidelines

## Advice for new contributors

Start small. The PRs most likely to be merged are the ones that make small,
easily reviewed changes with clear and specific intentions.
[guidelines on pull requests](#pull-requests).

It's a good idea to gauge interest in your intended work by finding the current issue
for it or creating a new one yourself. Use Github issues as a place to signal
your intentions and get feedback from the users most likely to appreciate your changes.

You're most likely to have your pull request accepted if it addresses an existing Github issue marked with the [good-first-issue](https://github.com/oxen-io/session-desktop/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) tag, these issues are specifically tagged, because they are generally features/bug fixes which can be cleanly merged on a single platform without requiring cross platform work, are generally of lower complexity than larger features and are non contentious, meaning that the core team doesn't need to try and assess the community desire for such a feature before merging.

Of course we encourage community developers to work on ANY issue filed on our Github regardless of how it’s tagged, however if you pick up or create an issue without the “Good first issue” tag it would be best if you leave a comment on the issue so that the core team can give you any guidance required, especially around UI heavy features or issues which require cross platform integration.

## Developer Setup

First, you'll need [Node.js](https://nodejs.org/) which matches our current version.
You can check [`.nvmrc` in the `clearnet` branch](https://github.com/oxen-io/session-desktop/blob/clearnet/.nvmrc) to see what the current version is. If you have [nvm](https://github.com/creationix/nvm)
you can just run `nvm use` in the project directory and it will switch to the project's
desired Node.js version.

If you are using Windows [nvm for windows](https://github.com/coreybutler/nvm-windows) is
still useful, but it doesn't support `.nvmrc` files. In this case you will need to `nvm install` the projects node version and `nvm use` the installed version

Then you need `git`, if you don't have that yet: https://git-scm.com/

## Platform Specific Instructions

### macOS

1.  Install the [Xcode Command-Line Tools](http://osxdaily.com/2014/02/12/install-command-line-tools-mac-os-x/).

### Windows

Building on Windows is a pain, but is possible see our CI/Windows build machine prerequisites here [Windows-2022 GH image](https://github.com/actions/runner-images/blob/main/images/win/Windows2022-Readme.md)

### Linux

1.  Install build tools `apt install build-essential cmake` (this installs make, g++, gcc)
2.  Depending on your distro, you might need to install `hunspell` and `hunspell-<lan>` (e.g. `hunspell-en-au`)

In Ubuntu, you may also need to install
```
sudo apt install cmake
npm install cmake-js
```

In Fedora, you may also need to install
```
sudo dnf install make automake gcc gcc-c++ kernel-devel
```


### All platforms

Now, run these commands in your preferred terminal in a good directory for development:

```
git clone https://github.com/oxen-io/session-desktop.git
cd session-desktop
npm install --global yarn      # (only if you don’t already have `yarn`)
yarn install --frozen-lockfile # Install and build dependencies (this will take a while)
yarn build-everything
yarn test                      # A good idea to make sure tests run first
yarn start-prod                # Start Session!
```

You'll need to restart the application regularly to see your changes, as there
is no automatic restart mechanism. Alternatively, keep the developer tools open
(`View > Toggle Developer Tools`), hover over them, and press
<kbd>Cmd</kbd> + <kbd>R</kbd> (macOS) or <kbd>Ctrl</kbd> + <kbd>R</kbd>
(Windows & Linux).

```
yarn build-everything:watch # runs until you stop it, re-generating built assets on file changes
# Once this command is waiting for changes, you will need to run in another terminal `yarn worker:utils && yarn worker:libsession` to fix the "exports undefined" error on start.
# If you do change the sass while this command is running, it won't pick it up. You need to either run `yarn sass` or have `yarn sass:watch` running in a separate terminal.
```

## Multiple instances

Since there is no registration for Session, you can create as many accounts as you
can public keys. Each client however has a dedicated storage profile which is determined by the environment and instance variables.

This profile will change [userData](https://electron.atom.io/docs/all/#appgetpathname)
directory from `%appData%/Session` to `%appData%/Session-{environment}-{instance}`.

There are a few scripts which you can use:

```
yarn start-prod - Start production but in development mode
MULTI=1 yarn start-prod - Start another instance of production
```

For more than 2 clients, you may run the above command with `NODE_APP_INSTANCE` set before them.
For example, running:

```
NODE_APP_INSTANCE=alice yarn start-prod
```

Will run the development environment with the `alice` instance and thus create a separate storage profile.

If a fixed profile is needed (in the case of tests), you can specify it using `storageProfile` in the config file. If the change is local then put it in `local-{instance}.json` otherwise put it in `default-{instance}.json` or `{env}-{instance}.json`.

Local config files will be ignored by default in git.

For example, to create an 'alice' profile locally, put a file called `local-alice.json` in the
`config` directory:

```
{
  "storageProfile": "alice-profile",
}
```

This will then set the `userData` directory to `%appData%/Session-alice-profile` when running the `alice` instance.

# Making changes

So you're in the process of preparing that pull request. Here's how to make that go
smoothly.

## Tests

Please write tests! Our testing framework is
[mocha](http://mochajs.org/) and our assertion library is
[chai](http://chaijs.com/api/assert/).

The easiest way to run all tests at once is `yarn test`.

## Committing your changes

Before a commit is accepted the staged changes will be formatted using [prettier](https://prettier.io/) and linted using [eslint](https://eslint.org/). The commit will be reverted if files are formatted or lint errors are returned.

### Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

Commit messages will be checked using [husky](https://typicode.github.io/husky/#/) and [commitlint](https://commitlint.js.org/).

## Pull requests

So you wanna make a pull request? Please observe the following guidelines.

- First, make sure that your `yarn ready` run passes - it's very similar to what our
  Continuous Integration servers do to test the app.
- Never use plain strings right in the source code - pull them from `messages.json`!
  You **only** need to modify the default locale
  [`_locales/en/messages.json`](_locales/en/messages.json).
  Other locales are generated automatically based on that file and then periodically
  uploaded to Crowdin for translation. If you add or change strings in messages.json
  you will need to run [`tools/updateI18nKeysType.py`](tools/updateI18nKeysType.py)
  this script generates updated TypeScript type definitions to ensure you aren't
  using a localisation key which doesn't exist.
- Please do not submit pull requests for pure translation fixes. Anyone can update
  the translations at [Crowdin](https://crowdin.com/project/session-desktop).
- [Rebase](https://nathanleclaire.com/blog/2014/09/14/dont-be-scared-of-git-rebase/) your
  changes on the latest `clearnet` branch, resolving any conflicts.
  This ensures that your changes will merge cleanly when you open your PR.
- Be sure to add and run tests!
- Make sure the diff between `clearnet` and your branch contains only the
  minimal set of changes needed to implement your feature or bugfix. This will
  make it easier for the person reviewing your code to approve the changes.
  Please do not submit a PR with commented out code or unfinished features.
- Avoid meaningless or too-granular commits. If your branch contains commits like
  the lines of "Oops, reverted this change" or "Just experimenting, will
  delete this later", please [squash or rebase those changes away](https://robots.thoughtbot.com/git-interactive-rebase-squash-amend-rewriting-history).
- Don't have too few commits. If you have a complicated or long lived feature
  branch, it may make sense to break the changes up into logical atomic chunks
  to aid in the review process.
- Provide a well written and nicely formatted commit message. See [this
  link](http://chris.beams.io/posts/git-commit/)
  for some tips on formatting. As far as content, try to include in your
  summary
  1.  What you changed
  2.  Why this change was made (including git issue # if appropriate)
  3.  Any relevant technical details or motivations for your implementation
      choices that may be helpful to someone reviewing or auditing the commit
      history in the future. When in doubt, err on the side of a longer
      commit message.
Above all, spend some time with the repository. Follow the pull request template added to
your pull request description automatically. Take a look at recent approved pull requests,
see how they did things.

## Production Builds

You can build a production binary by running the following:

```
yarn build-everything
yarn build-release
```
