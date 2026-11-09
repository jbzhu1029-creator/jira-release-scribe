import { invoke } from '@forge/bridge';
import {
  Button,
  Heading,
  HelperMessage,
  Inline,
  Label,
  Lozenge,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  TextArea,
  Textfield,
  Link,
  useProductContext,
} from '@forge/react';
import { useEffect, useState } from 'react';
import { jqlForFixVersion } from '../core/jql';
import { GROUP_LABELS, RELEASE_GROUPS, type Audience, type ReleaseGroup, type ReleaseIssue, type ReleaseNotes } from '../core/types';
import { buildPageTitle } from '../core/publish';

interface Option {
  label: string;
  value: string;
}

interface Project {
  id: string;
  key: string;
  name: string;
}

interface Version {
  id: string;
  name: string;
  released: boolean;
  archived: boolean;
  releaseDate?: string;
}

interface Space {
  id: string;
  key: string;
  name: string;
}

interface Result<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const GROUP_APPEARANCE: Record<ReleaseGroup, 'success' | 'inprogress' | 'removed' | 'default'> = {
  features: 'success',
  improvements: 'inprogress',
  bugfixes: 'removed',
  other: 'default',
};

const PREVIEW_LIMIT = 8;

const AUDIENCE_TABS: { id: Audience | 'markdown'; label: string }[] = [
  { id: 'engineering', label: 'Engineering' },
  { id: 'customer', label: 'Customer' },
  { id: 'executive', label: 'Executive' },
  { id: 'markdown', label: 'Markdown' },
];

async function call<T>(name: string, payload?: Record<string, unknown>): Promise<Result<T>> {
  try {
    return (await invoke(name, payload)) as Result<T>;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The request failed.' };
  }
}

function readContextProjectKey(extension: unknown): string {
  if (!extension || typeof extension !== 'object') return '';
  const project = (extension as { project?: { key?: unknown } }).project;
  return typeof project?.key === 'string' ? project.key : '';
}

function versionLabel(version: Version): string {
  const state = version.archived ? 'archived' : version.released ? 'released' : 'unreleased';
  return version.releaseDate ? `${version.name} (${state}, ${version.releaseDate})` : `${version.name} (${state})`;
}

function audienceText(notes: ReleaseNotes, tab: Audience | 'markdown'): string {
  if (tab === 'markdown') return notes.markdown;
  return notes.audiences[tab];
}

export function App() {
  const context = useProductContext();
  const contextProjectKey = readContextProjectKey(context?.extension);

  const [mode, setMode] = useState<'version' | 'jql'>('version');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectKey, setProjectKey] = useState('');
  const [projectTouched, setProjectTouched] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionName, setVersionName] = useState('');
  const [jql, setJql] = useState('');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState('');
  const [notes, setNotes] = useState<ReleaseNotes | undefined>();
  const [pageTitle, setPageTitle] = useState('');
  const [published, setPublished] = useState<{ url?: string; title: string } | undefined>();
  const [error, setError] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [spacesWarning, setSpacesWarning] = useState('');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!projectTouched && contextProjectKey) setProjectKey(contextProjectKey.toUpperCase());
  }, [contextProjectKey, projectTouched]);

  useEffect(() => {
    let cancelled = false;
    void call<Project[]>('listProjects').then((result) => {
      if (cancelled) return;
      setLoadingProjects(false);
      if (!result.ok || !result.data) {
        setError(result.error ?? 'Could not list projects.');
        return;
      }
      setProjects(result.data);
    });
    void call<Space[]>('listSpaces').then((result) => {
      if (cancelled) return;
      setLoadingSpaces(false);
      if (!result.ok || !result.data) {
        setSpacesWarning(result.error ?? 'Confluence spaces could not be loaded. You can still copy the notes.');
        return;
      }
      setSpaces(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectKey) {
      setVersions([]);
      setVersionName('');
      return;
    }
    let cancelled = false;
    setLoadingVersions(true);
    setVersionName('');
    void call<Version[]>('listVersions', { projectKey }).then((result) => {
      if (cancelled) return;
      setLoadingVersions(false);
      if (!result.ok || !result.data) {
        setVersions([]);
        setError(result.error ?? 'Could not list fix versions.');
        return;
      }
      setVersions(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [projectKey]);

  const projectOptions: Option[] = projects.map((project) => ({
    label: `${project.key} — ${project.name}`,
    value: project.key,
  }));
  const versionOptions: Option[] = versions.map((version) => ({
    label: versionLabel(version),
    value: version.name,
  }));
  const spaceOptions: Option[] = spaces.map((space) => ({
    label: space.key ? `${space.name} (${space.key})` : space.name,
    value: space.id,
  }));

  let resolvedJql = '';
  if (mode === 'version' && projectKey && versionName) {
    try {
      resolvedJql = jqlForFixVersion(projectKey, versionName);
    } catch {
      resolvedJql = '';
    }
  }

  const canGenerate = mode === 'jql' ? jql.trim().length > 0 : Boolean(projectKey && versionName);

  async function generate() {
    setError('');
    setPublished(undefined);
    setGenerating(true);
    const payload =
      mode === 'version'
        ? { mode, projectKey, versionName }
        : { mode, jql };
    const result = await call<ReleaseNotes>('generateNotes', payload);
    setGenerating(false);
    if (!result.ok || !result.data) {
      setNotes(undefined);
      setError(result.error ?? 'Could not draft release notes.');
      return;
    }
    setNotes(result.data);
    setPageTitle(buildPageTitle(result.data.title, result.data.generatedAt));
  }

  async function publish() {
    if (!notes) return;
    setError('');
    setPublishing(true);
    const issues: ReleaseIssue[] = RELEASE_GROUPS.flatMap((group) => notes.groups[group]);
    const result = await call<{ id?: string; url?: string; title: string }>('publishNotes', {
      spaceId,
      title: pageTitle,
      releaseTitle: notes.title,
      generatedAt: notes.generatedAt,
      truncated: notes.truncated,
      sourceDetail: notes.sourceDetail,
      issues,
    });
    setPublishing(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Could not publish the page.');
      return;
    }
    setPublished(result.data);
  }

  return (
    <Stack space="space.200">
      <Heading as="h1" size="medium">
        Release Scribe
      </Heading>
      <Text>
        Turn a fix version, or any JQL query, into release notes for engineering, customers, and executives. Drafts
        are rendered in the app. Nothing is sent to an external model.
      </Text>

      {error ? <SectionMessage appearance="error" title="Something needs attention">{error}</SectionMessage> : null}

      <Label labelFor="source-mode">Source</Label>
      <Select
        inputId="source-mode"
        options={[
          { label: 'Fix version', value: 'version' },
          { label: 'JQL query', value: 'jql' },
        ]}
        value={{ label: mode === 'version' ? 'Fix version' : 'JQL query', value: mode }}
        onChange={(option) => {
          const selected = option as Option | null;
          setMode(selected?.value === 'jql' ? 'jql' : 'version');
        }}
      />

      {mode === 'version' ? (
        <Stack space="space.150">
          <Label labelFor="project">Project</Label>
          <Select
            inputId="project"
            isSearchable
            isLoading={loadingProjects}
            placeholder="Choose a project"
            options={projectOptions}
            value={projectOptions.find((option) => option.value === projectKey) ?? null}
            onChange={(option) => {
              const selected = option as Option | null;
              setProjectTouched(true);
              setProjectKey(selected?.value ?? '');
            }}
          />
          <HelperMessage>Projects you can browse. The project you have open is selected when its key is in the list.</HelperMessage>

          <Label labelFor="version">Fix version</Label>
          <Select
            inputId="version"
            isSearchable
            isLoading={loadingVersions}
            isDisabled={!projectKey}
            placeholder={projectKey ? 'Choose a fix version' : 'Choose a project first'}
            options={versionOptions}
            value={versionOptions.find((option) => option.value === versionName) ?? null}
            onChange={(option) => {
              const selected = option as Option | null;
              setVersionName(selected?.value ?? '');
            }}
          />
          {projectKey && !loadingVersions && versions.length === 0 ? (
            <HelperMessage>This project has no fix versions yet.</HelperMessage>
          ) : null}
          {resolvedJql ? <HelperMessage>{resolvedJql}</HelperMessage> : null}
        </Stack>
      ) : (
        <Stack space="space.100">
          <Label labelFor="jql">JQL</Label>
          <TextArea
            id="jql"
            value={jql}
            minimumRows={4}
            onChange={(event) => setJql(String(event.target.value ?? ''))}
            placeholder='project = PROJ AND fixVersion = "1.2.0" ORDER BY key ASC'
          />
          <HelperMessage>The query runs as you, so it can only return issues you can already see. Limit 2,000 characters.</HelperMessage>
        </Stack>
      )}

      <Button appearance="primary" isDisabled={!canGenerate || generating} onClick={() => void generate()}>
        {generating ? 'Drafting…' : 'Draft release notes'}
      </Button>
      {generating ? <Spinner label="Drafting release notes" /> : null}

      {notes ? (
        <Stack space="space.200">
          <Heading as="h2" size="small">
            {notes.title}
          </Heading>
          <Text>
            {notes.truncated
              ? `${notes.issueCount} issues shown. Results stop at 200.`
              : `${notes.issueCount} ${notes.issueCount === 1 ? 'issue' : 'issues'}.`}
          </Text>
          <Inline space="space.100" alignBlock="center">
            {RELEASE_GROUPS.map((group) => (
              <Lozenge key={group} appearance={GROUP_APPEARANCE[group]}>
                {GROUP_LABELS[group]} {notes.counts[group]}
              </Lozenge>
            ))}
          </Inline>

          {RELEASE_GROUPS.map((group) => {
            const issues = notes.groups[group];
            if (issues.length === 0) return null;
            const visible = issues.slice(0, PREVIEW_LIMIT);
            return (
              <Stack key={group} space="space.050">
                <Heading as="h3" size="xsmall">
                  {GROUP_LABELS[group]}
                </Heading>
                {visible.map((issue) => (
                  <Text key={issue.key}>
                    {issue.key}: {issue.summary}
                  </Text>
                ))}
                {issues.length > visible.length ? (
                  <Text>{`${issues.length - visible.length} more in the notes below.`}</Text>
                ) : null}
              </Stack>
            );
          })}

          <Tabs id="release-notes-audiences">
            <TabList>
              {AUDIENCE_TABS.map((tab) => (
                <Tab key={tab.id}>{tab.label}</Tab>
              ))}
            </TabList>
            {AUDIENCE_TABS.map((tab) => (
              <TabPanel key={tab.id}>
                <Stack space="space.100">
                  <Label labelFor={`notes-${tab.id}`}>{tab.label}</Label>
                  <TextArea
                    id={`notes-${tab.id}`}
                    isReadOnly
                    isMonospaced
                    minimumRows={12}
                    value={audienceText(notes, tab.id)}
                  />
                  <HelperMessage>Select the text and copy it. The wording is rule-based, so the same issues always produce the same draft.</HelperMessage>
                </Stack>
              </TabPanel>
            ))}
          </Tabs>

          <Heading as="h2" size="small">
            Publish to Confluence
          </Heading>
          <Label labelFor="space">Space</Label>
          <Select
            inputId="space"
            isSearchable
            isLoading={loadingSpaces}
            placeholder="Choose a space"
            options={spaceOptions}
            value={spaceOptions.find((option) => option.value === spaceId) ?? null}
            onChange={(option) => {
              const selected = option as Option | null;
              setSpaceId(selected?.value ?? '');
            }}
          />
          <HelperMessage>
            {spacesWarning || 'Current spaces you can see, up to 100. You need permission to create a page there.'}
          </HelperMessage>

          <Label labelFor="page-title">Page title</Label>
          <Textfield
            id="page-title"
            value={pageTitle}
            onChange={(event) => setPageTitle(String(event.target.value ?? ''))}
          />

          <Button appearance="primary" isDisabled={!spaceId || !pageTitle.trim() || publishing} onClick={() => void publish()}>
            {publishing ? 'Publishing…' : 'Publish page'}
          </Button>
          {publishing ? <Spinner label="Publishing Confluence page" /> : null}
          {published ? (
            <SectionMessage appearance="success" title="Page created">
              {published.url ? (
                <Link href={published.url} openNewTab>
                  {published.title}
                </Link>
              ) : (
                <Text>{published.title}</Text>
              )}
            </SectionMessage>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
