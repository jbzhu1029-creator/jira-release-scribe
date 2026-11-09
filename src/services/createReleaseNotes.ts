import { assertCustomJql } from '../core/jql';
import { generateReleaseNotes } from '../core/notes';
import type { ReleaseIssue, ReleaseNotes } from '../core/types';

export interface IssueSearch {
  searchByJql(jql: string): Promise<{ issues: ReleaseIssue[]; truncated: boolean }>;
}

export interface ReleaseRequest {
  jql: string;
  title: string;
  generatedAt: string;
  sourceDetail?: string;
}

export async function createReleaseNotes(search: IssueSearch, request: ReleaseRequest): Promise<ReleaseNotes> {
  const jql = assertCustomJql(request.jql);
  const result = await search.searchByJql(jql);
  return generateReleaseNotes({
    title: request.title,
    generatedAt: request.generatedAt,
    issues: result.issues,
    truncated: result.truncated,
    sourceDetail: request.sourceDetail,
  });
}
