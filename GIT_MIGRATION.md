# Git Migration Guide: Reorganize into Monorepo Structure

This guide helps you migrate your existing git history into the new monorepo structure (`packages/backend` and `packages/frontend_flutter`) without losing any commit history.

---

## Overview

**Before**:
```
universal-trust-layer/
├── securerise/            (Backend code)
├── packages/frontend_flutter/  (Flutter code)
└── ...
```

**After**:
```
universal-trust-layer/
├── packages/
│   ├── backend/           (Moved from securerise/)
│   └── frontend_flutter/  (Already in packages/)
├── .gitignore
├── README.md
├── package.json
└── ...
```

---

## Prerequisites

- Git 2.39+
- Backup of your current repository:
  ```bash
  git clone --bare /path/to/universal-trust-layer universal-trust-layer-backup.git
  ```

---

## Option 1: Simple Move (Fastest)

Use this if you want to preserve history but don't need complex subdirectory filtering.

### Step 1: Backup Current State

```bash
# Navigate to repo root
cd /home/oajj2/Desktop/universal-trust-layer

# Create a backup branch before making changes
git branch backup-before-migration
git log --oneline | head -5  # Verify current history
```

### Step 2: Move Backend into packages/backend

```bash
# Create target directory
mkdir -p packages/backend-new
mv packages/backend-new packages/backend-temp

# Move securerise/ to packages/backend
mv securerise packages/backend

# Verify structure
ls -la packages/
# Expected: backend  frontend_flutter
```

### Step 3: Commit the Reorganization

```bash
git add packages/

git commit -m "refactor(monorepo): move backend to packages/backend

BREAKING: Directory structure has changed.
- Backend code moved from securerise/ → packages/backend
- Frontend code already in packages/frontend_flutter/
- Root-level configuration files (README, .gitignore) updated

Git history preserved.
History-rewriting: No (all commits preserved)"
```

### Step 4: Verify History is Intact

```bash
# Check that old commits are still accessible
git log --oneline packages/backend | head -10
# Should show backend-related commits

git log --oneline packages/frontend_flutter | head -10
# Should show frontend commits

# Show total commits
git log --oneline | wc -l
# Should match original count
```

---

## Option 2: Filter History by Directory (Advanced)

Use this if you want to **split backend and frontend into separate histories** with only relevant commits.

### Step 2a: Create Backend Repository

```bash
# Clone the repo fresh for history filtering
mkdir -p ~/temp-migration
cd ~/temp-migration

git clone /home/oajj2/Desktop/universal-trust-layer backend-repo
cd backend-repo

# Filter history to only backend commits
git filter-branch --subdirectory-filter securerise -- --all

# Rename main branch to backend's main
git branch -m main backend-main

# Verify only backend commits remain
git log --oneline | head -10
```

### Step 2b: Create Frontend Repository

```bash
cd ~/temp-migration

git clone /home/oajj2/Desktop/universal-trust-layer frontend-repo
cd frontend-repo

# Filter history to only frontend commits
git filter-branch --subdirectory-filter packages/frontend_flutter -- --all

# Rename main branch
git branch -m main frontend-main

# Verify
git log --oneline | head -10
```

### Step 2c: Merge Filtered Histories into New Monorepo

```bash
cd /home/oajj2/Desktop/universal-trust-layer

# Remove old directories
rm -rf securerise packages/frontend_flutter

# Add backend repository as remote
git remote add backend ~/temp-migration/backend-repo
git fetch backend backend-main

# Merge backend history (creates new commits in packages/backend)
git merge backend/backend-main --allow-unrelated-histories -m "merge(history): integrate backend history"

# Add frontend repository as remote
git remote add frontend ~/temp-migration/frontend-repo
git fetch frontend frontend-main

# Merge frontend history
git merge frontend/frontend-main --allow-unrelated-histories -m "merge(history): integrate frontend history"

# Clean up temporary remotes
git remote remove backend
git remote remove frontend

# Verify combined history
git log --oneline | head -20
```

---

## Option 3: Minimal Rewrite (Recommended for Large Repos)

Use this if you want to preserve complete history with minimal file operations.

### Step 1: Preserve Backup

```bash
cd /home/oajj2/Desktop/universal-trust-layer

git branch backup-$(date +%Y-%m-%d-%H%M%S)
```

### Step 2: Move Backend

```bash
# Create target directory structure
mkdir -p packages/backend-tmp

# Move securerise contents to packages/backend
cd packages
mkdir -p backend
cd ../securerise

# Use git mv to preserve blame
for file in *; do
  git mv "$file" "../packages/backend/$file"
done

cd ..
rmdir securerise
```

### Step 3: Update Git Tracking

```bash
# Stage the moves
git add -A

# Commit
git commit -m "refactor(structure): reorganize into monorepo

Move backend code from securerise/ → packages/backend/
Frontend already in packages/frontend_flutter/

All git history preserved with full blame attribution."
```

### Step 4: Verify & Cleanup

```bash
# Verify structure
tree -L 2 packages/

# Check blame still works
git blame packages/backend/src/index.ts | head -5

# Verify history count
git rev-list --count HEAD
```

---

## Post-Migration Steps

### 1. Update Remote URLs (if needed)

```bash
# If your origin points to GitHub
git remote -v

# If you need to update origin
git remote set-url origin https://github.com/your-username/securerise.git
```

### 2. Force Push (if working on feature branch)

```bash
# Only do this on feature branches, NOT main/master

git push origin your-branch --force
# or safer:
git push origin your-branch --force-with-lease
```

### 3. Update Local Development Setup

```bash
cd /home/oajj2/Desktop/universal-trust-layer

# Backend setup
cd packages/backend
npm install

# Frontend setup
cd ../frontend_flutter
flutter pub get

# Root setup
cd ../..
npm install
```

### 4. Verify All Tests Pass

```bash
# Backend tests
cd packages/backend
npm test

# Frontend tests
cd ../frontend_flutter
flutter test

# All good?
cd ../..
echo "✓ Migration successful!"
```

---

## Verify Migration Success

### Checklist

- [ ] All backend commits visible: `git log --oneline packages/backend | wc -l`
- [ ] All frontend commits visible: `git log --oneline packages/frontend_flutter | wc -l`
- [ ] Total commits unchanged: `git log --oneline | wc -l`
- [ ] Git blame works: `git blame packages/backend/src/app.ts | head -1`
- [ ] File permissions preserved: `ls -la packages/backend/src/`
- [ ] No uncommitted changes: `git status` → `working tree clean`
- [ ] Branches are correct: `git branch -a`
- [ ] Tags preserved: `git tag | head -10`

### Example Verification

```bash
# Count total commits in new structure
BACKEND_COMMITS=$(git log --oneline packages/backend | wc -l)
FRONTEND_COMMITS=$(git log --oneline packages/frontend_flutter | wc -l)
TOTAL_COMMITS=$(git log --oneline | wc -l)

echo "Backend commits: $BACKEND_COMMITS"
echo "Frontend commits: $FRONTEND_COMMITS"
echo "Total commits: $TOTAL_COMMITS"

# If TOTAL_COMMITS ≈ BACKEND_COMMITS + FRONTEND_COMMITS (accounting for merge commits)
# Then migration is successful
```

---

## Troubleshooting

### Issue: Merge Conflicts

```bash
# If conflicts occur during merge
git status

# Resolve conflicts in affected files
# Edit files to keep desired changes

# After resolving
git add <resolved-files>
git commit -m "resolve: merge conflicts during migration"
```

### Issue: Lost Commits

```bash
# Check reflog to find lost commits
git reflog | head -20

# Recover a lost commit
git branch recovery-branch <commit-hash>
```

### Issue: Too Many Merge Commits

```bash
# Squash merge commits (before pushing)
git rebase -i HEAD~N  # N = number of merge commits

# Mark merge commits as "squash"
# Keep main commit as "pick"
```

### Issue: Tags Not Showing

```bash
# Verify tags still exist
git tag | head -10

# If tags are missing, recreate them
git fetch origin 'refs/tags/*:refs/tags/*'
```

---

## Rollback Plan

If migration goes wrong:

```bash
# Reset to backup branch
git reset --hard backup-before-migration

# Or revert entire operation
git reflog
git reset --hard <original-commit-hash>

# Or restore from backup
cd ..
rm -rf universal-trust-layer
git clone universal-trust-layer-backup.git universal-trust-layer
```

---

## Automated Script (Optional)

Save this as `migrate-to-monorepo.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting monorepo migration..."

# Backup
echo "📦 Creating backup..."
git branch backup-$(date +%Y-%m-%d-%H%M%S)

# Move backend
echo "📂 Moving backend to packages/backend..."
mkdir -p packages/backend-tmp
mv securerise/* packages/backend-tmp/
rm -rf securerise
mv packages/backend-tmp packages/backend

# Commit
echo "💾 Committing changes..."
git add -A
git commit -m "refactor(monorepo): move backend to packages/backend

All git history preserved."

# Verify
TOTAL=$(git log --oneline | wc -l)
echo "✅ Migration complete!"
echo "   Total commits: $TOTAL"
echo "   Backup branch: backup-$(date +%Y-%m-%d-%H%M%S)"
```

Run it:
```bash
chmod +x migrate-to-monorepo.sh
./migrate-to-monorepo.sh
```

---

## Next Steps

After migration:

1. **Update CI/CD** to point to new paths (`packages/backend`, `packages/frontend_flutter`)
2. **Update documentation** links
3. **Notify team** of structure change
4. **Test deployments** to ensure everything still works
5. **Update Docker builds** if containerization is in place

---

## Questions?

Refer to:
- [Git Filter-Branch](https://git-scm.com/docs/git-filter-branch)
- [Git Reflog](https://git-scm.com/docs/git-reflog)
- [Conventional Commits](https://www.conventionalcommits.org/)
