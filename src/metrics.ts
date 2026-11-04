export function track(
  env: Env,
  event: string,
  userId: string,
  value = 1,
) {
  env.METRICS.writeDataPoint({
    indexes: [userId], // sampling key
    blobs: [event],
    doubles: [value],
  });
}
