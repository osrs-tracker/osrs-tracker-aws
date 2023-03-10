/** Will push a value to an array stored in a map */
export function mapArrayPush<T, U>(map: Map<T, Array<U>>, key: T, value: U): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}
