# Reproducible builds

In order to verify that Signal's official apps are correctly built from the open source code, we need *reproducible builds*. 

Reproducible builds help ensure that anyone, including you, can build Signal Desktop in a way that is completely identical to the official downloads available to all users. 

This provides an extra security layer to ensure that the builds aren't tampered with, corrupted, and built with the free open source code.

## Reproduce and verify the Windows/macOS build

Reproducible builds for macOS and Windows are not available yet.

## Reproduce and verify the Linux build

### Pre-requisites

- Docker Engine is installed and running on your computer
- You need `git`.
- This guide assumes you are running a Unix-based system, but should otherwise work on any platform that runs Docker Engine.

### Building

First, grab the source code by using `git`:

```bash
$ git clone https://github.com/signalapp/Signal-Desktop.git
```

This will download Signal Desktop's source code under the `Signal-Desktop` file. Once the download is complete, go inside the file and make sure you are selecting the branch used in official builds. For instance, if you are trying to build `7.18.0`, then do:

```bash
$ cd Signal-Desktop/
Signal-Desktop$ git checkout tags/7.16.0
```

You are now on the version of the source code used for `7.16.0`. Then, make sure your shell is in the `reproducible-builds` directory first:

```bash
Signal-Desktop$ cd reproducible-builds/
Signal-Desktop/reproducible-builds$ pwd
[...]/Signal-Desktop/reproducible-builds
```

Last step is to run the `./build.sh` script. (If your user is not in Docker's `docker` group, then you may need to run the script as `sudo`).

```bash
Signal-Desktop/reproducible-builds$ chmod +x ./build.sh
Signal-Desktop/reproducible-builds$ ./build.sh
```

This bash script will do two things. First, it will create the Docker container where Signal Desktop will be built. Second, it will build Signal Desktop inside the container. 

When the build is completed, the resulting file will be available at `Signal-Desktop/release/signal-desktop_7.18.0_amd64.deb`.

### Verify the official build

If you have followed the official Linux instructions to install Signal Desktop at https://signal.org/download/, then you will have `signal-desktop` available in your `apt` repositories. You can then simply grab the official build by typing:

```bash
$ apt download signal-desktop
```

This will automatically download the official `.deb` package.

To verify the official `.deb` package against your build, make sure that your version is the same as the official version, for example version `7.18.0`. Then, compare the checksums and make sure they are identical. If they are identical, then the two builds are exactly the same, and you have successfully reproduced Signal Desktop.

(Note: do not compare with the checksums given below! They only serve as a visual example of what the output would look like)

```bash
$ sha256sum signal-desktop_7.18.0_amd64-OUR_BUILD.deb signal-desktop_7.18.0_amd64_OFFICIAL_BUILD.deb

0df3d06f74c6855559ef079b368326ca18e144a28ede559fd76648a62ec3eed7  signal-desktop_7.18.0_amd64-OUR_BUILD.deb 
0df3d06f74c6855559ef079b368326ca18e144a28ede559fd76648a62ec3eed7  signal-desktop_7.18.0_amd64_OFFICIAL_BUILD.deb
```

### What to do if the checksums don't match

- File an issue [on the Github Issues page](https://github.com/signalapp/Signal-Desktop/issues).