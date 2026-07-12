// Extract a human-readable error message from an axios error.
// The server returns express-validator failures as { errors: [{ msg, path }] }
// and ad-hoc failures as { error: "msg" }. We surface whichever is present so
// the user can see *which* field was rejected instead of a bare status code.
export function extractApiError(err, fallback = 'Failed to submit') {
  const data = err?.response?.data;
  if (data?.errors?.length) {
    return data.errors
      .map((e) => (e.path ? `${e.path}: ${e.msg}` : e.msg))
      .join('; ');
  }
  return data?.error || err?.message || fallback;
}
