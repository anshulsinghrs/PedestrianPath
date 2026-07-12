# Contributing to BikeMaps Clone

Thanks for taking the time to contribute! 🚴

## Ways to contribute

- 🐛 **Report bugs** — open an issue with steps to reproduce, expected vs actual behaviour, and screenshots if relevant.
- 💡 **Suggest features** — open an issue describing the use case and a sketch of the proposed UX/API.
- 📝 **Improve docs** — typos, clarifications, missing examples — all welcome.
- 💻 **Submit code** — see the workflow below.

## Code workflow

1. **Fork** the repo and clone your fork.
2. Create a topic branch off `main`:
   ```bash
   git checkout -b feature/my-cool-thing
   ```
3. Install dependencies in both `server/` and `client/` (`npm install` in each).
4. Make your changes. Keep PRs focused — one logical change per PR.
5. Make sure both projects still build:
   ```bash
   cd client && npm run build
   cd ../server && npm start    # then ctrl-c
   ```
6. Commit using clear messages. We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat(map): add heatmap layer toggle
   fix(api): handle missing description in create incident
   docs(readme): clarify deployment steps
   ```
7. Push your branch and open a PR against `main`. Describe **what** changed and **why**.

## Style guidelines

- **JavaScript:** plain ESM, 2-space indent, single quotes, semicolons. Match the surrounding code.
- **React:** functional components + hooks. No class components, no Redux (context is enough for the MVP).
- **Naming:** components `PascalCase.jsx`, helpers `camelCase.js`, CSS classes `kebab-case`.
- **Comments:** explain *why*, not *what*. Code should already be readable for the *what*.
- **No console logs** in committed code (server logs via `morgan` are fine).

## Project layout reminders

- New API endpoints → add the controller in `server/controllers/`, wire it in `server/routes/`, and document it in the README.
- New components → add a sibling under `client/src/components/`. Pull shared metadata from `client/src/utils/incidentTypes.js`.
- New incident types → update `incidentTypes.js`, the Mongoose enum in `models/Incident.js`, and the validator in `routes/incidents.js`.

## Reporting security issues

Please **do not** open public issues for security vulnerabilities. Instead, email the maintainer directly. We'll respond within 72 hours.

## Code of Conduct

Be kind, be patient, assume good faith. Harassment and personal attacks are not tolerated. Maintainers reserve the right to remove comments, commits, and contributors that violate this principle.

Happy hacking!
