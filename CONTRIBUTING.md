# Contributing to THOTH

THOTH is a 3D viewer and annotator developed within the TEXTaiLES project. We welcome bug reports, documentation improvements, usability and accessibility feedback, and focused code contributions. Cultural-heritage expertise and reproducible workflow examples are valuable contributions; programming experience is not required to report a problem.

THOTH remains under active development. Review and implementation depend on maintainer capacity and project resources. Opening an issue or pull request does not guarantee acceptance or a response within a particular time.

## Before you start

Read the [user documentation](https://textailes.github.io/thoth-documentation/), [deployment guide](docs/DEPLOYMENT.md), and [support guidance](SUPPORT.md). Search existing issues before creating another report. For substantial changes to annotation formats, architecture, authentication, integrations, or dependencies, open a feature request and discuss the approach before implementation. Small corrections can be submitted directly.

Use the bug-report form for unexpected behavior and the feature-request form for a new capability. Explain the task you are trying to accomplish, not only the interface you would like to see. If a fault appears to originate in ATON or another dependency, provide the relevant versions and evidence; maintainers can help determine where it belongs.

## Branches and pull requests

- `main` is the default branch and contains released versions.
- `dev` is the integration branch for ongoing development.
- Create feature and bugfix branches from `dev`, and target ordinary pull requests at `dev`.
- Use descriptive names such as `fix/scene-loading`.
- Keep each pull request focused on one change; avoid unrelated reformatting.
- Maintainers promote validated development work from `dev` to `main` for releases, including major version updates. Temporary branches are removed after integration when no longer needed.
- Release promotion is a maintainer operation. Discuss any exceptional fix against `main` with a maintainer first.

For external contributors, fork the repository, clone your fork, and add the project as `upstream`:

```sh
git remote add upstream https://github.com/TEXTaiLES/thoth.git
git fetch upstream
git switch -c fix/describe-the-problem upstream/dev
```

Commit your changes, push the branch to your fork, and open a pull request against `TEXTaiLES/thoth:dev`. Draft pull requests are welcome when you need feedback before completion.

## Development setup

Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for native ATON, PM2, local Docker, and HESTIA Docker. Native installation places THOTH at `wapps/thoth` within ATON. Use the ATON revision documented there rather than assuming that the latest upstream commit is compatible. HESTIA testing requires a separately configured HESTIA/Directus stack and EGI configuration.

## Validation

THOTH does not yet have comprehensive automated application coverage. 
<!-- TODO: create validation tests -->

## Code, documentation, and compatibility

Follow the conventions of the files you change. Prefer clear names, small changes, and explanations for non-obvious behavior. Do not introduce a new formatter, dependency, or broad refactoring as part of an unrelated fix. No repository-wide formatter or lint command is prescribed by this guide.

Update documentation when changing user workflows, configuration, deployment, or behavior. Include screenshots for visible changes when useful. Explain changes to scene descriptors, annotations, measurement units, API contracts, or stored data, including compatibility and migration implications. Preserve existing data and permissions deliberately; flag any destructive behavior for review.

## Rights, attribution, and sample data

The repository's [LICENSE](LICENSE) contains the GNU General Public License version 3. Preserve applicable copyright and license notices. Submit only material you are entitled to share and contribute under the project's applicable terms. Identify third-party code and assets and provide their source, license, and required attribution. Discuss uncertain licensing with maintainers before submission.

The software license does not establish permission to redistribute museum collections, photographs, models, textures, annotations, or other research data. Use small synthetic or explicitly redistributable examples. Do not submit credentials, private keys, session cookies, personal information, confidential consortium documents, or restricted collection material. Remove sensitive information from screenshots and logs.

## Review and participation

Describe the problem, the change, and validation in the pull-request template. Maintainers may ask for revisions, additional evidence, or a smaller scope, and may decline changes that do not fit THOTH's direction or maintenance capacity. Address feedback respectfully and explain technical disagreements with reproducible evidence.

Treat contributors, users, and maintainers with respect. Do not disclose another person's private information. Concerns about behavior or security should not be reported through public technical issue forms.
