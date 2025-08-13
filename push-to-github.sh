#!/bin/bash

# Git commands to commit, tag, and push changes to GitHub
# Run this script to perform all necessary Git operations

# Ensure we're in the right directory
cd "$(dirname "$0")"

echo "🔍 Checking Git status..."
git status

echo "📦 Adding all changes..."
git add .

echo "💾 Committing changes..."
git commit -m "Fix v1.1.0: Analytics, Sessions, and Error Handling Improvements"

echo "🏷️ Creating tag v1.1.0..."
git tag -a v1.1.0 -m "Version 1.1.0 - Fixed analytics and sessions display, added error handling"

echo "🚀 Pushing changes to GitHub..."
git push origin main

echo "📤 Pushing tags to GitHub..."
git push origin v1.1.0

echo "✅ Done! Changes have been pushed to GitHub repository."
