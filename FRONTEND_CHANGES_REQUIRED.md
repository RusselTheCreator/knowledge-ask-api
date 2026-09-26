# Frontend Changes Required

## Repository
https://github.com/RusselTheCreator/knowledge-ask-frontend

## Branch
`cursor/multi-format-support-38ab`

## Changes Required

### File: `src/components/FileUpload.tsx`

#### Change 1: Update file input accept attribute (Line 69)
**From:**
```tsx
accept=".pdf,.txt,.md,.docx,.csv"
```

**To:**
```tsx
accept=".pdf,.txt,.md,.docx,.csv,.xlsx,.png,.jpg,.jpeg"
```

#### Change 2: Update UI text (Line 96)
**From:**
```tsx
<p style={styles.subtext}>
  PDF, TXT, MD, DOCX, or CSV (max 10MB)
</p>
```

**To:**
```tsx
<p style={styles.subtext}>
  PDF, TXT, MD, DOCX, CSV, XLSX, PNG, or JPG (max 10MB)
</p>
```

## Purpose
- Allow users to select XLSX files for upload
- Allow users to select PNG/JPG files for upload (will fail with clear error message until OCR is implemented)
- Keep UI in sync with backend supported file types

## Testing
1. Verify file picker shows correct file types
2. Verify XLSX files can be uploaded successfully
3. Verify PNG/JPG files show appropriate error message after upload

## Deployment
After merging the API PR and deploying, merge this frontend PR and deploy to ensure coordinated rollout.

## Patch File
A git patch file has been created: `0001-feat-Add-XLSX-and-image-file-type-support-to-upload.patch`

Apply with:
```bash
cd knowledge-ask-frontend
git checkout -b cursor/multi-format-support-38ab
git am /path/to/0001-feat-Add-XLSX-and-image-file-type-support-to-upload.patch
git push -u origin cursor/multi-format-support-38ab
```
