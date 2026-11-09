# Release Scribe

Release Scribe turns a Jira fix version, or any JQL query, into release notes a stakeholder can read. A Jira project page groups the issues and drafts three versions of the notes: internal engineering, customer-facing, and a one-paragraph executive summary. The same draft can be copied as Markdown or published as a Confluence page. A Rovo agent answers “draft release notes for version X” and “what changed since version Y” by calling the same code.

The wording is rule-based. It does not call an external model, so the draft is the same in CI, offline, and in production. Rovo can phrase the chat around the returned Markdown. The notes themselves stay reproducible.

Built for [Codegeist 2026](https://codegeist.devpost.com) (Devpost deadline 22 December 2026). Judges need an install link and a demo video under five minutes. Those last two steps need an Atlassian account and are listed at the end of this file.

## What the app does

On a Jira project page named **Release Scribe**:

1. Pick the open project (or another project you can browse) and a fix version, or switch to a JQL query.
2. See matching issues grouped into **Features**, **Improvements**, **Bug fixes**, and **Other**.
3. Read the three audiences, plus the full Markdown document, in a read-only field you can select and copy.
4. Choose a Confluence space and publish the notes as a page. The page is created with the Confluence v2 REST API through Forge `requestConfluence`.

In Rovo chat, the **Release Scribe** agent has two read-only actions:

| Action | What it answers |
| --- | --- |
| Draft release notes | Notes for one fix version, optionally for a single audience. |
| Changes since version | Issues whose fix version is ordered after a baseline version (`fixVersion >` in JQL). |

Both actions run as the person who invoked them, so they only see issues that person can already open.

## Architecture

```
Jira project page (UI Kit)          Rovo agent
        |                                |
        | invoke                         | action
        v                                v
   Forge resolver                  Forge functions
        \                              /
         v                            v
              Jira + Confluence calls
              (api.asUser, no egress)
                       |
                       v
              src/core  (pure TypeScript)
              group, summarise, Markdown, storage HTML
```

| Path | Role |
| --- | --- |
| `src/core` | Grouping, audience text, Markdown, Confluence storage XHTML, JQL quoting, response parsing. No Atlassian credentials and no Forge imports. |
| `src/services/createReleaseNotes.ts` | Runs a JQL search through an injected client, then calls the core. |
| `src/jira`, `src/confluence` | Forge product requests. Search uses `POST /rest/api/3/search/jql`. Pages are created with `POST /wiki/api/v2/pages`. |
| `src/resolvers` | UI Kit resolver for the project page. |
| `src/actions/releaseActions.ts` | Rovo action handlers. |
| `src/frontend` | UI Kit page (`render: native`). |
| `manifest.yml` | Modules, runtime, and scopes. Validated in CI with `@forge/manifest`. |

Issue types are grouped with fixed rules: names containing “bug”, “defect”, or “regress” are bug fixes; stories, features, and epics are features; improvements and enhancements stay improvements; everything else, including tasks and sub-tasks, is Other. Customer lines drop leading tags such as `[INTERNAL]` and conventional-commit prefixes such as `feat:`. Engineering lines keep the issue key, status, and priority. The executive paragraph is one sentence of counts plus up to three highlights.

An optional `SummaryRewriter` can rephrase customer and executive lines. The default rewriter is the rule above. A model-backed rewriter can be passed into `generateReleaseNotes` later. It is not wired up, and a rewriter that throws falls back to the rules, so the app still renders with no AI entitlement and no third-party HTTP call.

At most 200 issues are included. The draft says when that cap is hit. Custom JQL is limited to 2,000 characters. Publishing rebuilds the page from sanitized issue fields, so the storage body cannot carry raw HTML from the browser.

## Scopes and runtime

`manifest.yml` requests only:

| Scope | Why |
| --- | --- |
| `read:jira-work` | Projects, fix versions, and issue search. |
| `read:confluence-space.summary` | List spaces to publish into. |
| `write:confluence-content` | Create the release-notes page. |

There is no `permissions.external` block, so the app makes no third-party network calls. That is the Runs on Atlassian posture. After you log in, confirm with `forge eligibility`.

The runtime is `nodejs24.x` on `arm64`, which is the runtime the Forge manifest schema recommends for standard Atlassian cloud. Atlassian Government Cloud does not offer `arm64`; set `architecture: x86_64` before deploying there.

The Confluence v2 REST docs also name the granular scopes `read:space:confluence` and `write:page:confluence`. Classic scopes are what Forge recommends where they exist, and they are the ones declared here. If a create-page call returns a scope error, add those two granular scopes, deploy again, and run `forge install --upgrade`.

## Develop without an Atlassian login

Requirements: Node.js 20 or newer.

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run validate-manifest
```

`npm test` runs Vitest. It does not read the network and does not need Forge credentials. `validate-manifest` checks `manifest.yml` with the current `@forge/manifest` schema (the package Atlassian generates from the Forge manifest schema).

GitHub Actions runs lint, typecheck, tests, and manifest validation on every pull request.

## Deploy

The committed app id is a placeholder:

```yaml
# TODO: not a registered app. `forge register` replaces this.
id: ari:cloud:ecosystem::app/00000000-0000-4000-8000-000000000000
```

Do not commit the id `forge register` writes back. Keep that change local, or tell git to skip it (`git update-index --assume-unchanged manifest.yml`) after registering.

1. Install the CLI: `npm install -g @forge/cli@latest`
2. `forge login`
3. From this directory, `forge register`. Accept the prompt that replaces `app.id`.
4. `forge lint` (needs the login from step 2; CI already validates the schema offline).
5. `forge deploy -e development` while you are trying it on your own site.
6. `forge install --site your-site.atlassian.net --product jira --environment development`
7. Approve the consent screen. It lists the three scopes above. Confluence has to be on the same site for publishing. Generating and copying notes only needs Jira.
8. Open a Jira project, then **Release Scribe** in the project apps navigation. If Forge asks the user to grant access, accept it. That grant is what lets `api.asUser()` run.
9. For the judge install link, deploy production (`forge deploy -e production`) and, in the [developer console](https://developer.atlassian.com/console/myapps/), set distribution to **Sharing** and copy the installation link. A development-environment install is not a link judges can open.
10. After any scope change, deploy again and run `forge install --upgrade`.

`forge deploy` bundles the TypeScript UI and the functions. There is no separate frontend build.

Rovo has to be available on the site. The agent shows up in the Jira and Confluence chat panel as **Release Scribe**. Try:

- “Draft release notes for version 1.2.0 of PROJ”
- “What changed in PROJ since version 1.1.0?”
- “Give me the executive summary”

## Project layout for the submission

- [Devpost description draft](docs/devpost.md) — inspiration, what it does, how it was built, challenges, what is next.
- [Demo video script](docs/demo-script.md) — screen recording, on-screen captions, and an AI voiceover. No one needs to be on camera.

## Security

- Jira and Confluence are called with `api.asUser()`, including from Rovo actions, so the app sees only what the invoking person can see. Authorization does not trust an issue key or project key supplied by the model; the product API enforces browse permission.
- Project keys used in a URL path are checked against `^[A-Z][A-Z0-9]{1,9}$` before the request. Version names are quoted and escaped inside JQL.
- Page titles are length-capped. Issue summaries written into Confluence storage are XML-escaped. The publish handler rebuilds the page from sanitized fields instead of accepting HTML from the browser.
- No tokens, site names, or real app ids belong in git.

## License

[MIT](LICENSE)
