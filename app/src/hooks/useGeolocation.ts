import { useCallback, useEffect, useRef, useState } from "react";

// Request permission only after a visitor activates the location button.
export function useGeolocation() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const inFlight = useRef(false);
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; cancel.current?.(); }; }, []);

  const requestLocation = useCallback((): Promise<google.maps.LatLngLiteral | null> => {
    if (inFlight.current) return Promise.resolve(null);
    setError(null);
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location sharing. Search a suburb or town instead.");
      return Promise.resolve(null);
    }
    inFlight.current = true;
    setPending(true);
    return new Promise(resolve => {
      let settled = false;
      const finish = (location: google.maps.LatLngLiteral | null, message: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        inFlight.current = false;
        cancel.current = null;
        if (active.current) { setPending(false); setError(message); }
        resolve(active.current ? location : null);
      };
      const timeoutMessage = "Finding your location took too long. Try again or search a suburb or town.";
      // Also bound the permission prompt, which some browsers exclude from timeout.
      const timer = setTimeout(() => finish(null, timeoutMessage), 12_000);
      cancel.current = () => finish(null, null);
      try {
        navigator.geolocation.getCurrentPosition(position => {
          const { latitude: lat, longitude: lng } = position.coords;
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            finish(null, "Your location couldn't be found. Search a suburb or town instead.");
          } else finish({ lat, lng }, null);
        }, failure => finish(null, failure.code === 1
          ? "Location access was denied. You can still search a suburb or town."
          : failure.code === 3 ? timeoutMessage : "Your location couldn't be found. Try again or search a suburb or town."),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 });
      } catch { finish(null, "Location sharing is unavailable. Search a suburb or town instead."); }
    });
  }, []);
  return { requestLocation, pending, error };
}
