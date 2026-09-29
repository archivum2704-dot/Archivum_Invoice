/**
 * A v4-shaped random id for a new row whose id the app needs straight away.
 *
 * Deliberately not expo-crypto: that is a native module, so adding it would
 * make a JS-only change need a new binary instead of riding an over-the-air
 * update. The value is a primary key, never a secret — access is decided by
 * RLS, not by the id being unguessable — and the column's unique constraint
 * would surface a collision as an error rather than letting it corrupt anything.
 */
export function randomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
