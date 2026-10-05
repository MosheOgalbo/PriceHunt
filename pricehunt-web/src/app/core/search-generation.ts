/**
 * A result belongs to the search that subscribed to it.
 * After a newer search starts, events captured by the previous generation are dropped.
 */
export function isCurrentSearch(capturedGeneration: number, activeGeneration: number): boolean {
  return capturedGeneration === activeGeneration;
}
