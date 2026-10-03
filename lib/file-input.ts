/**
 * The files a user just picked in an <input type="file">, with the input
 * cleared so picking the same file again still fires `change`.
 *
 * ORDER MATTERS: `input.files` is a live FileList. Setting `input.value = ""`
 * empties that same list in Safari (and Chrome), so copying it afterwards
 * gets nothing — which silently broke every photo pick on iPhone. Copy first,
 * then clear.
 */
export function takeFiles(input: { files: ArrayLike<File> | null; value: string }): File[] {
  const files = Array.from(input.files ?? []);
  input.value = "";
  return files;
}
