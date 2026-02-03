# Contributing to SolMail MCP

Thank you for your interest in contributing to SolMail! This project was built for the Colosseum Agent Hackathon and we welcome community contributions.

## Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd solmail-mcp
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Build the project**
```bash
npm run build
```

5. **Run in development mode**
```bash
npm run dev  # Watch mode with automatic rebuilds
```

## Project Structure

```
solmail-mcp/
├── src/
│   └── index.ts          # Main MCP server implementation
├── dist/                 # Compiled JavaScript output
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .env.example          # Example environment variables
└── README.md             # User documentation
```

## Making Changes

### Code Style
- Use TypeScript with strict mode enabled
- Follow existing code formatting
- Add comments for complex logic
- Use meaningful variable names

### Testing Changes
1. Build the project: `npm run build`
2. Test with Claude Desktop (see README.md)
3. Verify all tools work correctly
4. Test error cases

### Submitting Pull Requests
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test thoroughly
5. Commit with clear messages: `git commit -m "Add feature: description"`
6. Push to your fork: `git push origin feature/your-feature`
7. Open a Pull Request with:
   - Clear description of changes
   - Rationale for the change
   - Testing performed
   - Screenshots/examples if applicable

## Feature Requests

Have an idea for SolMail? Open an issue with:
- Clear description of the feature
- Use case or problem it solves
- Example implementation (if applicable)
- Willingness to contribute code

## Bug Reports

Found a bug? Open an issue with:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Error messages or logs

## Areas for Contribution

### High Priority
- [ ] PDF attachment support
- [ ] USDC payment option (SPL token transfers)
- [ ] Bulk sending optimization
- [ ] Error recovery and retry logic
- [ ] Unit tests and integration tests

### Medium Priority
- [ ] Return address configuration
- [ ] Multiple letter templates
- [ ] Postcard format support
- [ ] Transaction history tracking
- [ ] Spending limits and controls

### Nice to Have
- [ ] Package/merchandise shipping
- [ ] Multi-chain support
- [ ] Web dashboard for transaction history
- [ ] CLI tool (non-MCP interface)
- [ ] Docker containerization

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Celebrate diversity of ideas

## Questions?

- Open a GitHub issue for bugs or features
- Check existing issues before creating new ones
- Be patient and respectful in discussions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for making SolMail better! 🚀📬
