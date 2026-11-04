export async function withCache<T>(
  kv: KVNamespace,
  key: string,
  seconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const cached = await kv.get<T>(key, "json");
  if (cached !== null) return cached;
  const value = await compute();
  await kv.put(key, JSON.stringify(value), { expirationTtl: seconds });
  return value;
}
