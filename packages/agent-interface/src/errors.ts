import type { ZodError } from 'zod';

export type AgentErrorCode =
  | 'VALIDATION_ERROR'
  | 'COMMAND_REJECTED'
  | 'PARSE_ERROR'
  | 'SCENE_INVALID';

export type AgentIssue = {
  path: (string | number)[];
  message: string;
};

export type AgentError = {
  code: AgentErrorCode;
  message: string;
  issues?: AgentIssue[];
};

export type AgentOk<T> = { ok: true; data: T };
export type AgentErr = { ok: false; error: AgentError };
export type AgentResult<T> = AgentOk<T> | AgentErr;

export const ok = <T>(data: T): AgentOk<T> => ({ ok: true, data });

export const err = (error: AgentError): AgentErr => ({ ok: false, error });

export const issuesFromZod = (e: ZodError): AgentIssue[] =>
  e.issues.map((i) => ({
    path: i.path,
    message: i.message,
  }));
