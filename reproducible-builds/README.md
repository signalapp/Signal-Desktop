<!-- Copyright 2024 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Reproducible builds

In order to verify that Signal's official apps are correctly built from the open source code, we need _reproducible builds_.

Reproducible builds help ensure that anyone, including you, can build Signal Desktop in a way that is completely identical to the official downloads available to all users.

This provides an extra security layer to ensure that the builds aren't tampered with, corrupted, and built with the free open source code.

## Reproduce and verify the Windows/macOS build

Reproducible builds for macOS and Windows are not available yet.

## Reproduce and verify the Linux build

### Experimental notice

> [!IMPORTANT]
> We are in the process of rolling out and verifying reproducible builds. As such, reproducibility is still
> experimental and may not work on public releases yet. If you notice any inconsistencies then please file an issue [on the Github Issues page](https://github.com/signalapp/Signal-Desktop/issues). Thanks for your patience while we set it up!

### Pre-requisites

- Docker Engine is installed and running on your computer
- You need `git`.
- This guide assumes you are running a Unix-based system, but should otherwise work on any platform that runs Docker Engine.

### Building

First, grab the source code by using `git`:

```bash
$ git clone https://github.com/signalapp/Signal-Desktop.git
$ cd Signal-Desktop/
```

This will download Signal Desktop's source code under the `Signal-Desktop` directory.

Now, select the version/branch you would like to verify. For instance, if you are trying to build `7.45.0`, then do:

```bash
$ git checkout tags/v7.45.0
```

> [!NOTE]
> This guide uses `v7.45.0` as the placeholder version. You may want to change this version to the most recent one. All the versions are available here: https://github.com/signalapp/Signal-Desktop/tags. Older versions may however not be reproducible.

At this point we are now on the branch of the source code used to build version `v7.45.0`. Before continuing, make sure your shell is in the `reproducible-builds` directory:

```bash
$ cd reproducible-builds/
$ pwd
[...]/Signal-Desktop/reproducible-builds
```

The last step is to run the `./build.sh` script, passing the `public` arg because you are verifying a public production or beta build.

> [!NOTE]
> If your user is not in Docker's `docker` group, then you may need to run the script as `sudo`.

```bash
$ chmod +x ./build.sh
$ ./build.sh public
```

This bash script will create the Docker container where Signal Desktop will be built, then download the required dependencies and start the build inside the container.

After the build is completed, the resulting file will be available in the `Signal-Desktop/release` folder. In our case, the file is named `signal-desktop_7.45.0_amd64.deb`.

### Verifying the build

#### Downloading the official release

> [!NOTE]
> For this step you will require a distro using the `apt` package manager, such as Debian, Ubuntu, Linux Mint, etc.

If you have followed the official Linux instructions to install Signal Desktop at https://signal.org/download/, then you will have the `signal-desktop` app available in your `apt` repositories. You can then simply grab the latest release build by typing:

```bash
$ apt download signal-desktop
```

This will automatically download the `.deb` package into the shell's working directory.

> [!TIP]
> If you would like to download the latest beta version instead of the release version, then use `signal-desktop-beta` instead.

#### Comparing your build against the official build

To verify the official `.deb` package against your build, make sure that your version is the same as the official version, and use `sha256sum` on both files to calculate the SHA-256 digest. Then compare/verify the output and verify that they match.

If the checksums from the official build and your own build match, then the two builds are exactly the same, and you have successfully reproduced Signal Desktop!

> [!TIP]
> Make sure your build is on the same version as the official build, otherwise they will not have the same checksum.

> [!WARNING]
> Do not compare your output against the checksums given below! They only serve as a visual example of what the output would look like. Yours will look different!

```bash
$ sha256sum ../release/signal-desktop_7.45.0_amd64-OUR_BUILD.deb signal-desktop_7.45.0_amd64_OFFICIAL_BUILD.deb

0df3d06f74c6855559ef079b368326ca18e144a28ede559fd76648a62ec3eed7  ../release/signal-desktop_7.45.0_amd64-OUR_BUILD.deb
0df3d06f74c6855559ef079b368326ca18e144a28ede559fd76648a62ec3eed7  signal-desktop_7.45.0_amd64_OFFICIAL_BUILD.deb
```

### What to do if the checksums don't match

- Double check you have followed the instructions correctly and are comparing the right versions.
- File an issue [on the Github Issues page](https://github.com/signalapp/Signal-Desktop/issues).
