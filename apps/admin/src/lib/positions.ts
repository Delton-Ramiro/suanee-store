import type { SelectOption } from "@/components/ui/MultiSelectDropdown";

/**
 * Build a smart position options list for a SingleSelectDropdown.
 *
 * Shows all integer slots from `startFrom` to `max(occupiedPositions)+1`,
 * including gaps, so the user can see and fill empty slots.
 *
 * - Occupied slots → disabled, hint "ocupado"
 * - The item's own current slot → selectable, hint "atual"
 * - The next free slot beyond the max → selectable, hint "próximo disponível"
 * - Other free gaps → selectable, no hint
 */
export function buildPositionOptions({
  occupiedPositions,
  nextPosition,
  currentPosition,
  startFrom = 1,
}: {
  occupiedPositions: number[];
  nextPosition: number;
  /** The position already held by the item being edited (kept selectable). */
  currentPosition?: number;
  /** Lowest allowed position value. 1 for categories, 0 for collections. */
  startFrom?: number;
}): SelectOption[] {
  /* Positions occupied by OTHER items (current item's slot stays selectable) */
  const occupiedSet = new Set(
    occupiedPositions.filter((p) => p !== currentPosition),
  );

  const maxOccupied =
    occupiedPositions.length > 0
      ? Math.max(...occupiedPositions)
      : startFrom - 1;

  /* Range: startFrom … max(maxOccupied + 1, nextPosition) */
  const end = Math.max(maxOccupied + 1, nextPosition);

  return Array.from(
    { length: end - startFrom + 1 },
    (_, i) => startFrom + i,
  ).map((pos) => {
    const isOccupied = occupiedSet.has(pos);
    const isCurrent = pos === currentPosition;
    const isNextFree = !isOccupied && pos === nextPosition && !isCurrent;

    let hint: string | undefined;
    if (isCurrent) hint = "atual";
    else if (isOccupied) hint = "ocupado";
    else if (isNextFree) hint = "próximo disponível";

    return {
      value: String(pos),
      label: String(pos),
      disabled: isOccupied,
      hint,
    };
  });
}
