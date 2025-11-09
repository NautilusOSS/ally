# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Defly wallet support
- WalletConnect support and wallet disconnect functionality
- Wallet connection validation and WalletConnect session handling
- Swap API integration and enhanced routing system
- Enhanced route breakdown with expandable cards
- VersionDisplay component to show app version in UI
- Automated version management system with prebuild script
- Version update script (scripts/update-version.cjs) for automatic patch version increments
- Version setup script (scripts/setup-version-management.sh) for initial configuration

### Changed
- Improved swap UI and token selection logic
- Updated README documentation
- Moved PROMPT.md to docs/ directory
- SwapInterface now displays version information via VersionDisplay component
- Build process now automatically increments patch version before each build

### Fixed
- Various wallet connection fixes
- WalletConnect related fixes
- General bug fixes

## [1.0.0] - 2025-09-05

### Added
- Initial commit: Ally DEX aggregator MVP
- Basic swap interface
- Wallet connection functionality
- Token selection and routing

[Unreleased]: https://github.com/yourusername/ally/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/ally/releases/tag/v1.0.0

