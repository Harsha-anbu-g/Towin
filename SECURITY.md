# Security

## On-demand security scans

Two security scans live in this repo. Both are **manual** — they run only when
someone triggers them, never automatically on a push or pull request. This keeps
the slow scans out of everyday CI while making it visible that they exist.

Run either from **GitHub → Actions → (pick the workflow) → Run workflow**, or with
the `gh` CLI:

| Scan | What it checks | How to run | Setup needed |
|------|----------------|-----------|--------------|
| **Security - Snyk (manual)** | Known vulnerabilities in backend (Maven) and frontend (npm) dependencies, plus Snyk Code static analysis | `gh workflow run security-snyk.yml` | One-time: add a `SNYK_TOKEN` repo secret (free token from <https://app.snyk.io/account>). Until then it skips-and-passes with a warning. |
| **Security - SonarQube (self-hosted, manual)** | Code quality, bugs, and security hotspots across backend (with JaCoCo coverage) and frontend | `gh workflow run security-sonarqube.yml` | None. Boots a throwaway SonarQube server inside the job — no account, no secret. |

Both are **report-only**: findings appear in the run logs and never fail the run.
The SonarQube server is ephemeral (discarded when the run ends), so its results
live in that run's logs rather than a persistent dashboard.

Workflow files:
[.github/workflows/security-snyk.yml](.github/workflows/security-snyk.yml) ·
[.github/workflows/security-sonarqube.yml](.github/workflows/security-sonarqube.yml)

## Dependency CVE scan (Maven, already available)

The backend also ships an OWASP dependency-check profile you can run on demand,
locally or in CI:

```bash
cd backend && ./mvnw -Psecurity verify
```

It is deliberately kept out of the default build because the first run downloads
the full NVD database (slow). See the `security` profile in
[backend/pom.xml](backend/pom.xml).

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue: use
GitHub's **Security → Advisories → Report a vulnerability**, or contact the
repository maintainer directly.
