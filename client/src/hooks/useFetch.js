import { useEffect, useRef, useState } from "react";

// Loads data when `key` changes. `key` is a string that describes the request
// (for example the product handle, or "page|sort|search"). Typical use:
//   const { data, error, loading } = useFetch(() => getOrder(id), id);
//
// - loading: true until the answer for the CURRENT key has arrived
// - data:    the answer for the current key, or null while loading.
//            With keepPrevious the old answer stays visible meanwhile (paging).
// - error:   the Error of the current request (it has .status), or null
//
// An answer for an older key is dropped (race guard). Nothing calls setState while the
// effect runs: loading is worked out from the key, not stored.
export function useFetch(fetcher, key, { keepPrevious = false } = {}) {
  const [result, setResult] = useState({ key: undefined, data: null, error: null });
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher; // always call the latest fetcher, without re-running on every render
  });

  useEffect(() => {
    let ignore = false;
    fetcherRef.current()
      .then((data) => {
        if (!ignore) setResult({ key, data, error: null });
      })
      .catch((error) => {
        if (!ignore) setResult((prev) => ({ key, data: prev.data, error }));
      });
    return () => {
      ignore = true;
    };
  }, [key]);

  const current = result.key === key;
  return {
    data: current || keepPrevious ? result.data : null,
    error: current ? result.error : null,
    loading: !current,
  };
}
