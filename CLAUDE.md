# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js command-line tool that automates the distribution of macOS applications. It handles building, exporting, code signing, notarization, DMG creation, and Sparkle update framework integration.

## Key Commands

### Development
```bash
# Install dependencies
npm install

# Run the CLI
npm start -- [command] [options]
# or directly
node src/cli.js [command] [options]

# Lint code
npm run lint

# Run tests (currently no tests exist)
npm test
```

### CLI Usage
```bash
# Complete release workflow
distribute-macos-app release \
  --src-dir /path/to/xcode/project \
  --out-dir /path/to/output \
  --keychain-profile "YourNotarizationProfile"

# Generate Sparkle files only
distribute-macos-app sparkle \
  --dmg-path /path/to/existing.dmg \
  --src-dir /path/to/xcode/project \
  --out-dir /path/to/output
```

## Architecture

The codebase follows a modular structure with each major step in its own module:

1. **cli.js**: Entry point using Commander.js for CLI interface
2. **build.js**: Handles Xcode build and export operations
   - Extracts project settings (scheme, version, team ID)
   - Performs xcodebuild archive and export-archive
3. **dmg.js**: Creates and notarizes DMG files
   - Uses create-dmg for DMG creation
   - Handles code signing and notarization via xcrun notarytool
4. **sparkle.js**: Generates Sparkle update framework files
   - Creates release notes from changelog.yaml
   - Generates appcast.xml using generate_appcast
5. **github.js**: GitHub integration (implementation pending)

## Important Implementation Details

### Missing Dependencies
The following packages are used but not listed in package.json:
- `prompts` - Used for user confirmation prompts
- `js-yaml` - Used for parsing changelog.yaml

### System Requirements
This tool requires several system dependencies:
- Xcode and xcodebuild
- create-dmg
- GraphicsMagick (gm) and ImageMagick (magick)
- Sparkle framework with generate_appcast tool
- Valid Apple Developer ID certificates
- Notarization credentials stored in keychain

### Key Conventions
- ES modules throughout (type: "module" in package.json)
- Async/await for all asynchronous operations
- Chalk for colored terminal output
- Execa for subprocess execution
- Error messages include helpful context and suggestions

### Workflow Details

The release command executes these steps:
1. Validates source directory contains .xcodeproj
2. Extracts build configuration from Xcode project
3. Checks Git status and prompts for confirmation
4. Archives the app using xcodebuild
5. Exports archive with Developer ID signing
6. Creates DMG using create-dmg
7. Code signs the DMG
8. Notarizes DMG with Apple
9. Generates Sparkle appcast.xml
10. Cleans up temporary files

### File Structure Requirements
Projects using this tool need:
- `.xcodeproj` file in source directory
- `changelog.yaml` for release notes generation
- Sparkle private key in keychain ("Private key for signing Sparkle updates")
- Properly configured MARKETING_VERSION in Xcode project