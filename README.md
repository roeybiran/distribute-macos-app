# Distribute macOS App

A command-line tool that builds, exports, signs and notarizes a macOS application.

Work in progress!

## Usage

```shell
npx -y @roeybiran/distribute-macos-app release \
  --scheme MyApp \
  --keychain-profile notary-profile
```

Optional DMG customization:
`--dmg-background path/to/background.png`

Fast local DMG preview with the unsigned `DUMMY.app` fixture:

```shell
npm run build && node dist/index.js preview-dmg \
  --dmg-background /absolute/path/to/background.png \
  --reveal
```

## DMG Backgrounds

- The DMG icon layout is explicit, not automatic.
- The app icon center is currently placed at `(192, 240)` when no custom background is used.
- The `/Applications` link center is currently placed at `(448, 240)` when no custom background is used.
- The default icon size is `80`.
- The `x` and `y` values are relative to each icon's center.
- The horizontal gap between icon centers is `256 pt`.
- With the default `80 pt` icon size, the visible gap between the two icon edges is `176 pt`.
- Without a custom background, `appdmg` falls back to its default window size of `640x480`, so the default icon `y` position is `240`.
- If you provide `--dmg-background`, the tool passes it straight through to `appdmg` without inspecting its size.
- The icon layout stays point-based, so with or without a custom background or `@2x` sibling the icon `y` position remains `240`.
- For backgrounds that line up with the default layout, use `640x480` for the base image and `1280x960` for an optional matching `@2x` image.
- For Figma, make the frame the exact pixel size you want the DMG window to be, leave clear space around those two icon centers, and keep extra room below each icon for the Finder label text.
- If you want a retina background, export a matching `@2x` asset next to the base image, for example `background.png` and `background@2x.png`.
- `preview-dmg` always uses the built-in `DUMMY.app` fixture, skips code signing and notarization, stages the fixture app in a temp directory, and leaves only the final DMG in the chosen output directory.

Generate Sparkle files as part of the same release flow:

```shell
npx -y @roeybiran/distribute-macos-app release \
  --scheme MyApp \
  --keychain-profile notary-profile \
  --sparkle \
  --out-dir releases
```

When `--sparkle` is enabled, the source directory must include a `CHANGELOG.md` file. The tool copies that file next to the built DMG using the same basename, and `generate_appcast` picks it up natively as Markdown release notes.

## Read More

### Distribution

- [Distribution — Apple Developer Documentation](https://developer.apple.com/documentation/xcode/distribution)
- [Notarizing macOS software before distribution — Apple Developer Documentation](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)

### Signing

- [Code Signing Resources — Apple Developer Forums](https://developer.apple.com/forums/thread/707080)
- [Creating API Keys for App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api)

### Notarization

To create a new credential profile, run:
`xcrun notarytool store-credentials "${profile}" --key PATH_TO_PRIVATE_KEY --key-id KEY_ID --issuer ISSUER_ID`
Generating the profile can be done through [App Store Connect](https://appstoreconnect.apple.com/access/integrations/api). [Learn more](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api#Download-and-Store-a-Team-Private-Key).

- [Customizing the notarization workflow — Apple Developer Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow)
- [Customizing the Xcode archive process — Apple Developer Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow/customizing_the_xcode_archive_process)
- [Notarize a Command Line Tool with notarytool — Scripting OS X](https://scriptingosx.com/2021/07/notarize-a-command-line-tool-with-notarytool/)

### Archiving, Building, Exporting

- [Technical Note TN2339: Building from the Command Line with Xcode FAQ](https://developer.apple.com/library/archive/technotes/tn2339/_index.html#//apple_ref/doc/uid/DTS40014588-CH1-HOW_DO_I_ARCHIVE_AND_EXPORT_MY_APP_FOR_DISTRIBUTION_)
- [How to build an iOS app archive via command line](https://www.andrewhoog.com/post/how-to-build-an-ios-app-archive-via-command-line/)
- [Build iOS apps from the command line using xcodebuild](https://tarikdahic.com/posts/build-ios-apps-from-the-command-line-using-xcodebuild/)
- [Full Stack iOS Continuous Delivery with xcodebuild and ExportOptions Plist](https://heartbeat.comet.ml/full-stack-ios-continuous-delivery-with-xcodebuild-and-exportoptions-plist-28c48620593c)

### Creating DMGs

- [LinusU/node-appdmg](https://github.com/LinusU/node-appdmg/)
- [dmgbuild/dmgbuild](https://github.com/dmgbuild/dmgbuild/)

### Sparkle

- [Sparkle Documentation](https://sparkle-project.org/documentation/)
