// A user's search text goes into a LIKE pattern. "%" and "_" are wildcards there, so
// a search for "50%" would match everything. Put a backslash in front of them.
export const escapeLike = (s) => s.replace(/[\\%_]/g, "\\$&");
