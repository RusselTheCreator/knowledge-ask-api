#!/bin/bash

echo "🔍 Pre-Deployment Validation"
echo "=============================="

# Check 1: Verify all files are tracked by git
echo ""
echo "1. Checking for untracked files that should be committed..."
UNTRACKED=$(git ls-files --others --exclude-standard | grep -v "node_modules\|uploads\|test-results\|\.env$")
if [ -n "$UNTRACKED" ]; then
  echo "❌ WARNING: Untracked files found:"
  echo "$UNTRACKED"
  echo ""
  echo "Run: git add <files> to track them"
  exit 1
else
  echo "✅ All necessary files are tracked"
fi

# Check 2: Verify no CommonJS in ES module project
echo ""
echo "2. Checking for CommonJS syntax in ES module project..."
COMMONJS_FILES=$(grep -r "module.exports\|require(" --include="*.js" --exclude-dir=node_modules . 2>/dev/null || true)
if [ -n "$COMMONJS_FILES" ]; then
  echo "❌ WARNING: CommonJS syntax found (project uses ES modules):"
  echo "$COMMONJS_FILES"
  exit 1
else
  echo "✅ No CommonJS syntax found"
fi

# Check 3: Test if app starts
echo ""
echo "3. Testing if server starts..."
timeout 5 node index.js > /dev/null 2>&1 &
PID=$!
sleep 3
if kill -0 $PID 2>/dev/null; then
  echo "✅ Server starts successfully"
  kill $PID 2>/dev/null
  wait $PID 2>/dev/null
else
  echo "❌ Server failed to start"
  exit 1
fi

# Check 4: Verify all imports can be resolved
echo ""
echo "4. Checking for missing imports..."
node --check index.js 2>&1
if [ $? -eq 0 ]; then
  echo "✅ All imports resolve correctly"
else
  echo "❌ Import errors found"
  exit 1
fi

echo ""
echo "✅ All pre-deployment checks passed!"
echo "=============================="
