# Contributing to RATi

We love your input! We want to make contributing to RATi as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Development Setup

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### Local Development

1. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/rati.git
   cd rati
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Copy environment template**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development environment**
   ```bash
   docker-compose up -d
   ```

5. **Run tests**
   ```bash
   npm test
   npm run test:integration
   ```

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run lint
   npm test
   npm run docker:build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**

## Code Style

### JavaScript/Node.js

- Use ES6+ features
- Use `const` and `let`, avoid `var`
- Use arrow functions where appropriate
- Use template literals for string interpolation
- Follow the ESLint configuration

### React/Frontend

- Use functional components with hooks
- Use descriptive component and variable names
- Follow the existing CSS naming conventions
- Ensure responsive design

### Commit Messages

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

- `feat:` - A new feature
- `fix:` - A bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add chat interface with real-time updates
fix: resolve wallet connection issue
docs: update installation instructions
refactor: improve deployment service error handling
```

## Project Structure

```
rati/
├── agent/                 # AI agent implementation
├── deployment-service/    # Backend deployment service
├── frontend/             # React frontend application
├── scripts/              # Deployment and utility scripts
├── scrolls/              # Genesis documents
├── src/                  # Core AO process code
├── docker/               # Docker configurations
├── docs/                 # Documentation
└── tests/                # Test files
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### End-to-End Tests
```bash
npm run test:e2e
```

### Manual Testing
1. Start the full stack: `docker-compose up -d`
2. Run deployment tests: `./test-integration.sh`
3. Test the frontend at `http://localhost:3030`
4. Test the API at `http://localhost:3032`

## Documentation

- Update the README.md if you change functionality
- Add JSDoc comments to new functions
- Update API documentation for backend changes
- Include examples in your documentation

## Issue Reporting

### Bug Reports

Please include:

1. **Environment details** (OS, Node.js version, Docker version)
2. **Steps to reproduce** the issue
3. **Expected behavior**
4. **Actual behavior**
5. **Screenshots** (if applicable)
6. **Error logs** (with sensitive information removed)

### Feature Requests

Please include:

1. **Use case** - Why do you need this feature?
2. **Proposed solution** - How should it work?
3. **Alternatives considered** - What other approaches did you consider?
4. **Additional context** - Any other relevant information

## Architecture Guidelines

### Backend Services

- Use Express.js for API services
- Implement proper error handling
- Use environment variables for configuration
- Follow RESTful API conventions
- Include proper logging

### Frontend Components

- Keep components focused and reusable
- Use proper state management
- Implement error boundaries
- Follow accessibility guidelines
- Ensure mobile responsiveness

### Docker & Deployment

- Use multi-stage builds where appropriate
- Keep container images minimal
- Use Docker Compose for local development
- Include health checks
- Follow security best practices

## Security

### Reporting Security Issues

Please **DO NOT** create public GitHub issues for security vulnerabilities. Instead, email us directly at security@rati.ai with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if you have one)

### Security Best Practices

- Never commit sensitive information (API keys, private keys, passwords)
- Use environment variables for configuration
- Validate all inputs
- Implement proper authentication and authorization
- Keep dependencies updated

## Code Review Process

1. **Automated checks** - All PRs must pass CI/CD checks
2. **Code review** - At least one maintainer must review and approve
3. **Testing** - Changes must be tested (automated and manual)
4. **Documentation** - Updates must include relevant documentation changes

### Review Criteria

- Code quality and style
- Test coverage
- Performance impact
- Security considerations
- Documentation completeness
- Backward compatibility

## Community

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and community discussion
- **Discord** - Real-time chat and support
- **Twitter** - Announcements and updates

### Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Recognition

Contributors will be recognized in:

- README.md contributors section
- Release notes for significant contributions
- Annual contributor appreciation posts

## Getting Help

- Check existing issues and discussions first
- Read the documentation thoroughly
- Ask questions in GitHub Discussions
- Join our Discord for real-time help

## License

By contributing to RATi, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to RATi! 🚀
