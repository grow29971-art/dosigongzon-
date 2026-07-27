export interface CareInboxItem {
  doneTypes: readonly string[];
}

export function countPendingFeed<T extends CareInboxItem>(items: readonly T[]): number {
  return items.reduce(
    (total, item) => total + (item.doneTypes.includes("feed") ? 0 : 1),
    0,
  );
}

export function prioritizePendingFeed<T extends CareInboxItem>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        Number(a.item.doneTypes.includes("feed")) -
          Number(b.item.doneTypes.includes("feed")) ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}
