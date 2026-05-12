# Git Migration Guide: Monorepo Structure

This guide explains how to migrate your existing git history into the new monorepo folder structure without losing progress or commits.

---

## Current State vs New State

### Before Migration
```
securerise/
├── packages/
│   ├── backend/
│   ├── frontend_flutter/
│   └── docs/
├── securerise_mobile/      # OLD: Root-level Flutter app
├── src/                    # OLD: Root-level backend code
└── package.json
```

### After Migration
```
securerise/
├── packages/
│   ├── backend/            # NEW: Consolidated backend
│   ├── frontend_flutter/   # NEW: Unified Flutter app
│   └── docs/
├── .gitignore              # Enhanced for triple-platform
└── package.json            # Updated workspace config
```

---

## Migration Strategy

We'll use **git filter-branch** to move files into the new structure while preserving all history.

### Step 1: Backup Current Repository

```bash
cd ~/Desktop/universal-trust-layer/securerise
git status  # Ensure clean working directory

# Create a backup branch
git branch backup-pre-migration
```

### Step 2: Consolidate Backend into packages/backend

```bash
# If backend code exists at root (src/, node_modules, etc.)
# Move everything to packages/backend

# First, verify current structure
ls -la packages/backend/
ls -la src/                  # If it exists

# Check if backend is already in packages/backend
# If so, skip to Step 3
```

### Step 3: Migrate Frontend into packages/frontend_flutter

```bash
# If securerise_mobile exists at root, consolidate into packages/frontend_flutter

# Check if Flutter app exists at root
ls -la securerise_mobile/

# If packages/frontend_flutter already has a full Flutter project, no action needed
# Otherwise, migrate securerise_mobile content into packages/frontend_flutter
```

### Step 4: Update Root .gitignore

```bash
# The enhanced .gitignore has already been created
# Verify it includes all platforms
cat .gitignore | grep -E "(Flutter|Node|Web|IDE)"
```

### Step 5: Update Root package.json Workspaces

```bash
# Ensure workspaces includes both backend and frontend
cat package.json | grep -A3 '"workspaces"'

# Should show:
# "workspaces": [
#   "packages/backend",
#   "packages/frontend_flutter"
# ]
```

### Step 6: Commit Migration

```bash
# Stage all changes
git add -A

# Create descriptive commit
git commit -m "feat: migrate to monorepo structure (packages/backend, packages/frontend_flutter)"

# Verify migration
git log --oneline -5
```

---

## Git Filter-Branch (Advanced)

If you need to rewrite history to move files into new directories:

### Move Backend Code to packages/backend

```bash
# WARNING: This rewrites history. Use only if absolutely necessary.
git filter-branch --tree-filter '
  if [ -f "src/index.ts" ]; then
    mkdir -p packages/backend
    mv src/* packages/backend/ || true
  fi
' -- --all
```

### Move Frontend to packages/frontend_flutter

```bash
git filter-branch --tree-filter '
  if [ -d "securerise_mobile" ]; then
    mkdir -p packages/frontend_flutter
    mv securerise_mobile/* packages/frontend_flutter/ || true
  fi
' -- --all
```

---

## Clean Up After Migration

```bash
# Verify clean state
git status

# Check file history
git log --follow packages/backend/src/index.ts
git log --follow packages/frontend_flutter/lib/main.dart

# Delete backup branch if migration successful
git branch -d backup-pre-migration

# Force push to remote (if necessary - CAUTION!)
git push origin main --force-with-lease
```

---

## Verify Migration Integrity

### Check Package.json Structure

```bash
npm workspaces list
```

### Check Backend Functionality

```bash
cd packages/backend
npm install
npm run build
echo "✓ Backend builds successfully"
```

### Check Frontend Functionality

```bash
cd packages/frontend_flutter
flutter pub get
flutter analyze
echo "✓ Frontend analyzes successfully"
```

### Verify Git History

```bash
# Show commits for backend
git log --oneline packages/backend/ | head -10

# Show commits for frontend
git log --oneline packages/frontend_flutter/ | head -10

# Ensure no history was lost
git log --oneline | wc -l
```

---

## Troubleshooting

### "Files not found" after filter-branch

**Problem:** git filter-branch created new commits but files are missing.

**Solution:**
```bash
# Reset to backup
git reset --hard backup-pre-migration
# Re-check your move commands
```

### Conflicts with remote main

**Problem:** History rewrite conflicts with GitHub main branch.

**Solution:**
```bash
# Use force-with-lease (safer than force)
git push origin main --force-with-lease

# Or create a new branch and PR
git push origin migration-branch
# Then open PR to main
```

### Lost Commits

**Problem:** Some commits disappeared after migration.

**Solution:**
```bash
# Restore from backup
git reset --hard backup-pre-migration
# Try smaller, incremental migrations
```

---

## Final Verification Commands

```bash
# All at once
echo "=== Git Status ===" && \
git status && \
echo "=== Commit Count ===" && \
git log --oneline | wc -l && \
echo "=== Backend Files ===" && \
find packages/backend -name "*.ts" | wc -l && \
echo "=== Frontend Files ===" && \
find packages/frontend_flutter -name "*.dart" | wc -l && \
echo "✓ Migration complete!"
```

---

## Reference

- **git filter-branch docs**: `man git-filter-branch`
- **npm workspaces**: https://docs.npmjs.com/cli/v9/using-npm/workspaces
- **Flutter project structure**: https://flutter.dev/docs

