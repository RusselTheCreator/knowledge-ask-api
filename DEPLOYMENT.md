# Deployment Guide

## Pre-Deployment Checklist

Always run these checks before deploying:

### 1. Quick Pre-Deploy Check
```bash
npm run pre-deploy
```

This script checks for:
- ✅ All files are tracked in git
- ✅ No CommonJS syntax in ES module project
- ✅ Server starts successfully
- ✅ All imports resolve correctly

### 2. Run Tests
```bash
npm run test:all
```

### 3. Deploy (with automatic checks)
```bash
npm run deploy
```

This runs `pre-deploy` checks automatically, then pushes to GitHub.

---

## Common Issues & Prevention

### Issue #1: Missing Files in Git
**Problem:** Files exist locally but not committed to git

**Prevention:**
- Always run `git status` before committing
- Use `npm run pre-deploy` to detect untracked files
- Check GitHub after pushing to verify files are there

**Manual Check:**
```bash
git ls-files | grep -E "(database|middleware|utils)"
```

### Issue #2: Module System Mismatch
**Problem:** Mixing CommonJS (`require`) and ES modules (`import`)

**Prevention:**
- Project uses **ES modules** (`"type": "module"` in package.json)
- Always use `import`/`export`, never `require`/`module.exports`
- Run `npm run pre-deploy` to detect CommonJS syntax

**Good (ES Modules):**
```javascript
import express from 'express';
export default app;
```

**Bad (CommonJS):**
```javascript
const express = require('express');  // ❌ Don't use
module.exports = app;                 // ❌ Don't use
```

### Issue #3: Environment Variables
**Problem:** Missing DATABASE_URL or other env vars

**Prevention:**
- Check `.env.example` for required variables
- Set all variables on Render dashboard
- Test locally with `node index.js` before deploying

---

## Deployment Platforms

### Render (Current)
- **URL:** https://knowledge-ask-api.onrender.com
- **Auto-Deploy:** Enabled from GitHub `main` branch
- **Database:** PostgreSQL with pgvector

### Manual Deployment Steps
See main README.md for detailed setup instructions.

---

## GitHub Actions (Automated Checks)

The `.github/workflows/deploy-check.yml` runs automatically on every push:
- ✅ Checks for CommonJS syntax
- ✅ Verifies imports resolve
- ✅ Runs all tests
- ✅ Tests server startup

If checks fail, deployment should be blocked.
