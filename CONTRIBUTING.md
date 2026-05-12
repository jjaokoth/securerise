# Contributing to Universal Trust Layer

Thank you for contributing to Securerise Universal Trust Layer! This document provides guidelines and instructions for contributing.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm 9+
- **Flutter** 3.24+
- **Docker** (for backend testing)
- **Git** 2.39+

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/jjaokoth/securerise.git
cd securerise

# Install dependencies (both backend and frontend)
npm run setup

# Or manually:
cd packages/backend && npm install && cd ../..
cd packages/frontend_flutter && flutter pub get && cd ../..
```

---

## Development Workflow

### Branch Naming

```
feature/description          # New feature
bugfix/description          # Bug fix
refactor/description        # Code refactoring
docs/description            # Documentation
chore/description           # Maintenance tasks
```

Example:
```bash
git checkout -b feature/otp-verification-improvements
```

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: feat, fix, refactor, docs, chore, test, perf

**Examples**:
```
feat(trust-client): add exponential backoff retry logic
fix(safety-net): correct GPS coordinate validation
docs(mobile-setup): add iOS permission documentation
```

### Code Style

#### Backend (Node.js/TypeScript)

```bash
cd packages/backend

# Format code
npm run format

# Lint
npm run lint

# Fix linting issues
npm run lint -- --fix
```

#### Frontend (Flutter/Dart)

```bash
cd packages/frontend_flutter

# Format code
dart format lib/ test/

# Analyze code
dart analyze

# Fix issues
dart fix --apply
```

---

## Testing

### Backend Tests

```bash
cd packages/backend

# Run all tests
npm test

# Run specific test file
npm test -- src/trust/__tests__/handshake.test.ts

# Watch mode (for TDD)
npm run test:watch
```

### Frontend Tests

```bash
cd packages/frontend_flutter

# Run unit tests
flutter test

# Run widget tests
flutter test --tags=widget

# Run integration tests
flutter test integration_test/
```

---

## Pull Request Process

1. **Create a feature branch** (see Branch Naming above)

2. **Make changes** and commit following conventional commits

3. **Push to GitHub**:
   ```bash
   git push origin feature/your-feature
   ```

4. **Create Pull Request**:
   - Title: Clear, descriptive title
   - Description: Explain what changed and why
   - Reference related issues: "Fixes #123"
   - Add labels: bug, feature, documentation, etc.

5. **Address code review feedback**

6. **Wait for CI/CD to pass**:
   - Tests pass ✓
   - Linting passes ✓
   - Coverage doesn't decrease ✗

7. **Get approval** from maintainers

8. **Squash and merge** or maintainer will merge

### Example PR Description

```markdown
## Description
Fixes: #456

Implements OTP rate-limiting to prevent brute-force attacks.

## Changes
- Add rate limiter middleware to `/handshake/:id/verify` endpoint
- Store failed OTP attempts in Redis (24-hour expiry)
- Return 429 (Too Many Requests) after 5 failed attempts

## Testing
- Added tests for rate limiter with 10 scenarios
- Tested with Redis in Docker
- Manual testing on staging environment

## Screenshots/Logs
[If applicable]
```

---

## Reporting Issues

### Bug Reports

Include:
- **Environment**: OS, Node version, Flutter version
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Logs/error messages**
- **Screenshots** (if UI-related)

### Feature Requests

Include:
- **Problem statement**: What problem does this solve?
- **Proposed solution**
- **Alternatives considered**
- **Additional context**

---

## Documentation

### Updating Documentation

Documentation lives in `packages/docs/`:

- **API_REFERENCE.md** — API endpoint documentation
- **ARCHITECTURE.md** — System design and data flows
- **MOBILE_SETUP.md** — Flutter development guide

When making code changes that affect API or architecture, update corresponding docs.

### README Updates

Update root [README.md](README.md) if:
- Adding new features
- Changing project structure
- Adding new dependencies
- Updating deployment process

---

## Release Process

### Version Bumping

We use semantic versioning: `MAJOR.MINOR.PATCH`

```bash
# For patch release (bug fixes)
npm version patch    # 1.0.0 → 1.0.1

# For minor release (new features)
npm version minor    # 1.0.0 → 1.1.0

# For major release (breaking changes)
npm version major    # 1.0.0 → 2.0.0
```

### Creating Release

1. Update [CHANGELOG.md](CHANGELOG.md) with release notes
2. Create git tag: `git tag v1.2.3`
3. Push tag: `git push origin v1.2.3`
4. GitHub Actions auto-deploys to Cloud Run

---

## Security Reporting

**Do NOT open a public issue for security vulnerabilities.**

Email security concerns to: **securerise@outlook.com**

Include:
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all.

### Our Standards

Examples of behavior that contributes to a positive environment:
- Using welcoming and inclusive language
- Being respectful of differing opinions
- Accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting securerise@outlook.com. All complaints will be reviewed and investigated.

---

## Getting Help

- **Questions**: Open a GitHub Discussion or email securerise@outlook.com
- **Documentation**: See [README.md](README.md) and [packages/docs/](packages/docs/)
- **Issues**: Check [GitHub Issues](https://github.com/jjaokoth/securerise/issues)

---

## Recognition

Contributors are recognized in the project README under [Contributors](#contributors) section.

Thank you for helping build Universal Trust Layer! 🙏

---

## Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Flutter Style Guide](https://dart.dev/guides/language/effective-dart/style)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
