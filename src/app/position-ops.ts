import { Candidate, Position, Presidency, Status, newId } from './models';

/** Pure transformations of a position. Each returns a new Position; nothing is mutated. */

export function addProposed(pos: Position, name: string): Position {
  const trimmed = name.trim();
  if (!trimmed) return pos;
  return { ...pos, proposed: [...pos.proposed, { id: newId(), name: trimmed }] };
}

/** Fills an empty primary spot directly with a new name as "Considered". */
export function setPrimary(pos: Position, name: string): Position {
  const trimmed = name.trim();
  if (!trimmed || pos.primary) return pos;
  return { ...pos, primary: { id: newId(), name: trimmed, status: 'considered' } };
}

export function renameCandidate(pos: Position, id: string, name: string): Position {
  const trimmed = name.trim();
  if (!trimmed) return pos;
  if (pos.primary?.id === id) return { ...pos, primary: { ...pos.primary, name: trimmed } };
  return { ...pos, proposed: pos.proposed.map((c) => (c.id === id ? { ...c, name: trimmed } : c)) };
}

/**
 * Removes a name entirely, whether it is the primary or a proposed one.
 * Removing the primary moves the next proposed name up into the spot as "Considered".
 */
export function removeCandidate(pos: Position, id: string): Position {
  if (pos.primary?.id === id) {
    const [next, ...rest] = pos.proposed;
    return next
      ? { ...pos, primary: { id: next.id, name: next.name, status: 'considered' }, proposed: rest }
      : { ...pos, primary: null };
  }
  return { ...pos, proposed: pos.proposed.filter((c) => c.id !== id) };
}

/** Moves a proposed name into the primary spot as "Considered". */
export function promote(pos: Position, candidate: Candidate): Position {
  const proposed = pos.proposed.filter((c) => c.id !== candidate.id);
  // Whoever was in the spot goes back to the top of the proposed list.
  if (pos.primary) proposed.unshift({ id: pos.primary.id, name: pos.primary.name });
  return {
    ...pos,
    primary: { id: candidate.id, name: candidate.name, status: 'considered' },
    proposed,
  };
}

/** Moves the primary name back to the top of the proposed list. */
export function demote(pos: Position): Position {
  if (!pos.primary) return pos;
  return {
    ...pos,
    primary: null,
    proposed: [{ id: pos.primary.id, name: pos.primary.name }, ...pos.proposed],
  };
}

export function setStatus(pos: Position, status: Status): Position {
  return pos.primary ? { ...pos, primary: { ...pos.primary, status } } : pos;
}

// ---- callings within a group (the "Other callings" section) ----

function slugKey(title: string, taken: Set<string>): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'calling';
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
  return key;
}

export function addPosition(pres: Presidency, title: string): Presidency {
  const trimmed = title.trim();
  if (!trimmed) return pres;
  const key = slugKey(trimmed, new Set(pres.positions.map((p) => p.key)));
  return {
    ...pres,
    positions: [...pres.positions, { key, title: trimmed, primary: null, proposed: [] }],
  };
}

export function renamePosition(pres: Presidency, key: string, title: string): Presidency {
  const trimmed = title.trim();
  if (!trimmed) return pres;
  return {
    ...pres,
    positions: pres.positions.map((p) => (p.key === key ? { ...p, title: trimmed } : p)),
  };
}

/** Removes a calling only while nobody is listed for it. */
export function removeEmptyPosition(pres: Presidency, key: string): Presidency {
  const pos = pres.positions.find((p) => p.key === key);
  if (!pos || pos.primary || pos.proposed.length > 0) return pres;
  return { ...pres, positions: pres.positions.filter((p) => p.key !== key) };
}
