# Changelog

All notable changes to the Spelling Practice App will be documented in this file.

## [1.1.0] - 2025-08-13

### Fixed
- Analytics graph no longer goes off the page (added SVG clipping paths)
- Results and Sessions tabs now show correct data for all users
- Admin1 sessions now visible in the interface
- Fixed issues with reading results.json file

### Added
- API Test Page for endpoint testing and debugging
- Support for different session data formats
- Filtering and pagination to the /getResults endpoint
- Comprehensive error handling for file operations
- Test script to verify data storage functionality
- DEBUG.md with troubleshooting instructions

### Changed
- Improved session data handling with better format compatibility
- Enhanced error logging with emoji indicators for better readability
- Simplified file reading operations with proper error handling
- Updated saveResults endpoint to handle edge cases better

## [1.0.0] - 2024-10-15

### Initial Release
- Spelling practice functionality
- User management
- Admin panel
- Analytics
- Gamification features
- Spaced repetition system
