#
# Copyright (C) 2014 codedust.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
#
# This is the build script for libphonenumber-api.
# See https://github.com/codedust/libphonenumber-api for more information.

# check if ant is installed
command -v ant >/dev/null 2>&1 || { echo >&2 "Apache Ant is required for building. Aborting."; exit 1; }

# clone/checkout dependencies
echo "Do you wish to update the dependencies (closure-library, closure-compiler, closure-linter and python-gflags)?"
select yn in "Yes" "No"; do
    case $yn in
        Yes)    echo "Cloning/Checking out dependencies..."
                rm -rf deps/closure-library
                rm -rf deps/closure-compiler
                rm -rf deps/closure-linter
                rm -rf deps/python-gflags
                git clone https://github.com/google/closure-library.git deps/closure-library
                git clone https://github.com/google/closure-compiler.git deps/closure-compiler
                svn checkout http://closure-linter.googlecode.com/svn/trunk/ deps/closure-linter
                svn checkout http://python-gflags.googlecode.com/svn/trunk/ deps/python-gflags
                break;;
        No )    break;;
        *)      echo "Please choose one of the options above, dude! ;)";
    esac
done

# update libphonenumber
echo "Do you wish to update 'deps/libphonenumber'?"
select yn in "Yes" "No"; do
    case $yn in
        Yes)    rm -rf deps/libphonenumber
                svn checkout http://libphonenumber.googlecode.com/svn/trunk/ deps/libphonenumber
                break;;
        No )    break;;
        *)      echo "Please choose one of the options above, dude! ;)";
    esac
done

echo "Building closure-compiler..."
ant -f deps/closure-compiler/build.xml

echo "Building libphonenumber-api..."
ant -f build-api.xml compile-libphonenumber_api

echo ""
echo "INFO: If build fails because of 'GetJavaVersion' in deps/closure-library/closure/bin/calcdeps.py,"
echo "change 'version_line' to 'version_line.decode('utf-8')'"
echo "INFO: If build fails because of 'Compile' in deps/closure-library/closure/bin/calcdeps.py,"
echo "change 'stdoutdata' to 'stdoutdata.decode('utf-8')'"

echo "The demo (of the complied version) can be found here:"
echo "$(pwd)/demo-libphonenumber-compiled.html"
