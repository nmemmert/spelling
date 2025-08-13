# Debugging the Spelling Practice App

This document provides guidance on debugging and testing the app's data handling functionality.

## Testing Tools

### 1. API Test Page

A user-friendly interface for testing the API endpoints:

- **URL**: http://localhost:3000/api-test.html
- **Features**:
  - Test the `/getResults` endpoint to retrieve session data
  - Create and save new test sessions with customizable parameters
  - View session details for specific users

### 2. Test Script

A Node.js script to verify the saveResults endpoint functionality:

```bash
node test-save-results.js
```

This script:
1. Verifies the server is running
2. Creates a test session for "testuser"
3. Validates the session was saved correctly
4. Shows summary information about the saved session

## Common Issues

### File Access Issues

If you're experiencing issues with data storage or retrieval:

1. **Check file permissions**:
   - Make sure the `data` directory is writable by the Node.js process
   - In Docker environments, ensure volume mounts are set up correctly

2. **Verify file formats**:
   - The app expects JSON files in a specific format
   - If manually editing files, validate the JSON structure before restarting

3. **Inspect server logs**:
   - The server outputs detailed logs with emoji indicators
   - Look for error messages marked with ❌

### Session Data Troubleshooting

If sessions aren't appearing correctly:

1. **Format compatibility**:
   - The app supports multiple data formats for backward compatibility
   - Session data may use either `timestamp` or `date` fields
   - Word data may be in `answers` or `words` arrays

2. **Data verification flow**:
   - Save a session using the API test page
   - Check the response from the `/saveResults` endpoint
   - Verify data using the `/getResults` endpoint
   - Confirm it appears in the UI

## Server Recovery

If the server stops working:

1. **Restart the server**:
   ```bash
   node server.js
   ```

2. **Check for errors in the logs**

3. **Data integrity check**:
   - Inspect JSON files in the `data` directory for formatting issues
   - Restore from backups or seed files if needed

## Recent Fixes

- Added backup data display when `results.json` can't be read
- Improved error handling in saveResults endpoint
- Created helper functions to handle different session data formats
- Added SVG clipping paths to fix analytics graph display issues
