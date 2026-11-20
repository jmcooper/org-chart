import { Candidate, Position, Presidency, ReleaseStatus, Status, newId } from './models';

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
  // Re-adding a calling with a key that was removed earlier un-removes it.
  const removedKeys = (pres.removedKeys ?? []).filter((k) => k !== key);
  const next: Presidency = {
    ...pres,
    positions: [...pres.positions, { key, title: trimmed, primary: null, proposed: [] }],
  };
  if (removedKeys.length) next.removedKeys = removedKeys;
  else delete next.removedKeys;
  return next;
}

export function renamePosition(pres: Presidency, key: string, title: string): Presidency {
  const trimmed = title.trim();
  if (!trimmed) return pres;
  return {
    ...pres,
    positions: pres.positions.map((p) => (p.key === key ? { ...p, title: trimmed } : p)),
  };
}

/** Removes a calling and everyone listed for it. */
export function removePosition(pres: Presidency, key: string): Presidency {
  if (!pres.positions.some((p) => p.key === key)) return pres;
  const removedKeys = [...new Set([...(pres.removedKeys ?? []), key])];
  return { ...pres, positions: pres.positions.filter((p) => p.key !== key), removedKeys };
}

/** Moves a calling to a new index within its group. */
export function movePosition(pres: Presidency, from: number, to: number): Presidency {
  const n = pres.positions.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return pres;
  const positions = [...pres.positions];
  const [moved] = positions.splice(from, 1);
  positions.splice(to, 0, moved);
  return { ...pres, positions };
}

// ---- releases ----

export function addRelease(pos: Position, name: string): Position {
  const trimmed = name.trim();
  if (!trimmed || pos.release) return pos;
  return { ...pos, release: { id: newId(), name: trimmed, status: 'releaseNeeded' } };
}

/** Renames the person being released; an empty name removes the release. */
export function renameRelease(pos: Position, name: string): Position {
  if (!pos.release) return pos;
  const trimmed = name.trim();
  if (!trimmed) return { ...pos, release: null };
  return { ...pos, release: { ...pos.release, name: trimmed } };
}

export function setReleaseStatus(pos: Position, status: ReleaseStatus): Position {
  return pos.release ? { ...pos, release: { ...pos.release, status } } : pos;
}

/** Adds a release that is not attached to any calling, as its own entry in the group. */
export function addStandaloneRelease(pres: Presidency, name: string): Presidency {
  const trimmed = name.trim();
  if (!trimmed) return pres;
  const key = slugKey('release', new Set(pres.positions.map((p) => p.key)));
  return {
    ...pres,
    positions: [
      ...pres.positions,
      {
        key,
        title: 'Release',
        primary: null,
        proposed: [],
        release: { id: newId(), name: trimmed, status: 'releaseNeeded' },
        releaseOnly: true,
      },
    ],
  };
}
