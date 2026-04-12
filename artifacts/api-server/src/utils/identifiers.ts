export function normalizeIdentifierSearch(value?: string | null) {
  const search = value?.trim();
  if (!search) {
    return null;
  }

  const numericId = /^\d+$/.test(search) ? Number(search) : null;
  return {
    text: search,
    pattern: `%${search}%`,
    numericId: numericId == null || Number.isNaN(numericId) ? null : numericId,
  };
}

export function formatEntityReference(prefix: string, id: number) {
  return `${prefix}-${id}`;
}
