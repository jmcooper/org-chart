export type Status = 'considered' | 'agreed' | 'called' | 'sustained' | 'setApart';

export type PositionKey = 'president' | 'first' | 'second' | 'secretary';

export interface Candidate {
  id: string;
  name: string;
}

export interface PrimaryCandidate extends Candidate {
  status: Status;
}

export interface Position {
  key: PositionKey;
  title: string;
  /** The name currently occupying the spot (considered → set apart). */
  primary: PrimaryCandidate | null;
  /** Other names under consideration, in display order. */
  proposed: Candidate[];
}

/** A presidency or bishopric within an organization. */
export interface Presidency {
  id: string;
  name: string;
  /** Layout row on the full chart: 1 = leadership (top), 2 = auxiliaries. */
  row: number;
  positions: Position[];
}

export interface OrgChart {
  updatedAt: string | null;
  presidencies: Presidency[];
}

/** A ward, branch, or other unit. Its PIN never leaves the server. */
export interface Org {
  id: string;
  name: string;
}

export interface OrgList {
  defaultOrgId: string | null;
  orgs: Org[];
}

export const PIN_PATTERN = /^[A-Za-z]{5}$/;

export interface StatusInfo {
  value: Status;
  label: string;
}

/** Ordered list of statuses as a calling progresses. */
export const STATUSES: readonly StatusInfo[] = [
  { value: 'considered', label: 'Considered' },
  { value: 'agreed', label: 'Agreed' },
  { value: 'called', label: 'Called' },
  { value: 'sustained', label: 'Sustained' },
  { value: 'setApart', label: 'Set Apart' },
];

export function statusLabel(status: Status): string {
  return STATUSES.find((s) => s.value === status)?.label ?? status;
}

/** Short random id that works on plain http (no crypto.randomUUID needed). */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
