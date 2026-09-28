import { Candidate, Position, Status, newId } from './models';

/** Pure transformations of a position. Each returns a new Position; nothing is mutated. */

export function addProposed(pos: Position, name: string): Position {
  const trimmed = name.trim();
  if (!trimmed) return pos;
  return { ...pos, proposed: [...pos.proposed, { id: newId(), name: trimmed }] };
}

export function renameCandidate(pos: Position, id: string, name: string): Position {
  const trimmed = name.trim();
  if (!trimmed) return pos;
  if (pos.primary?.id === id) return { ...pos, primary: { ...pos.primary, name: trimmed } };
  return { ...pos, proposed: pos.proposed.map((c) => (c.id === id ? { ...c, name: trimmed } : c)) };
}

/** Removes a name entirely, whether it is the primary or a proposed one. */
export function removeCandidate(pos: Position, id: string): Position {
  if (pos.primary?.id === id) return { ...pos, primary: null };
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
