%global debug_package %{nil}

# Remove bundled libraries from requirements/provides
%global __requires_exclude ^(libffmpeg\\.so.*|libEGL\\.so.*|libGLESv2\\.so.*|libVkICD_mock_icd\\.so\\..*)$
%global __provides_exclude ^(lib.*\\.so.*)$

Name:       Signal-Desktop
Version:    1.25.3
Release:    2%{?dist}
Summary:    Private messaging from your desktop
License:    GPLv3
URL:        https://signal.org/

Source0:    https://github.com/signalapp/%{name}/archive/v%{version}.tar.gz#/Signal-Desktop-%{version}.tar.gz
# Declare as source and not patch as patching is done later in the process:
Source1:    https://aur.archlinux.org/cgit/aur.git/plain/openssl-linking.patch?h=signal#/Signal-Desktop-openssl-linking.patch
Source2:    %{name}.desktop

BuildRequires:  desktop-file-utils
BuildRequires:  gcc-c++
BuildRequires:  git
BuildRequires:  nodejs
BuildRequires:  npm
BuildRequires:  openssl-devel
BuildRequires:  python-unversioned-command

Requires:   libappindicator-gtk3
Requires:   libnotify

Provides:   signal-desktop = %{version}-%{release}
Obsoletes:  signal-desktop < %{version}-%{release}

%description
Signal Desktop is an Electron application that links with Signal on Android or
iOS.

%prep
%autosetup

# Allow higher node versions:
sed -i 's/"node": "/&^/' package.json

%build
# Clean if not starting from scratch
rm -frv node_modules ~/.node-gyp

npm install yarn

node_modules/yarn/bin/yarn install
patch -p1 -i %{SOURCE1}
node_modules/yarn/bin/yarn generate --force
node_modules/yarn/bin/yarn build-release --dir

%install
# Main files
install -dm 755 %{buildroot}%{_libdir}/%{name}
install -dm 755 %{buildroot}%{_bindir}
cp -frv release/linux-unpacked/* %{buildroot}%{_libdir}/%{name}
ln -sf %{_libdir}/%{name}/signal-desktop %{buildroot}%{_bindir}/signal-desktop

# Icons
for size in 16 24 32 48 64 128 256 512 1024; do
    install -p -D -m 644 build/icons/png/${size}x${size}.png \
        %{buildroot}%{_datadir}/icons/hicolor/${size}x${size}/apps/%{name}.png
done

# Desktop file
install -m 0644 -D -p %{SOURCE2} \
    %{buildroot}%{_datadir}/applications/%{name}.desktop

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/%{name}.desktop

%files
%doc LICENSE
%{_bindir}/signal-desktop
%{_datadir}/applications/%{name}.desktop
%{_datadir}/icons/hicolor/*/apps/%{name}.png
%{_libdir}/%{name}

%changelog
* Wed Jul 24 2019 Simone Caronni <negativo17@gmail.com> - 1.25.3-2
- First build based on ArchLinux AUR.
