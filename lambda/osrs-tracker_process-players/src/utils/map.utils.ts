/** Will push a value to an array stored in a map */
export function mapArrayPush<T, U>(map: Map<T, Array<U>>, key: T, value: U): void {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}
