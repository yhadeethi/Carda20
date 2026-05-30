import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const STORAGE_KEY = "carda-my-profile";

export interface MyProfile {
  fullName: string;
  jobTitle: string;
  companyName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
}

const empty = (): MyProfile => ({
  fullName: "",
  jobTitle: "",
  companyName: "",
  email: "",
  phone: "",
  linkedinUrl: "",
});

export function useMyProfile(seed?: { name?: string; email?: string }) {
  const [profile, setProfileState] = useState<MyProfile>(empty());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      // 1. Apply seeds as initial fallback
      const base = empty();
      if (seed?.name) base.fullName = seed.name;
      if (seed?.email) base.email = seed.email;

      // 2. Check AsyncStorage cache first (fast path)
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<MyProfile>;
          setProfileState({ ...base, ...parsed });
          setIsLoaded(true);
        }
      } catch {}

      // 3. Fetch canonical data from the API
      try {
        const res = await fetch(`${BASE_URL}/api/auth/user`, { credentials: "include" });
        if (res.ok) {
          const user = await res.json();
          if (user) {
            const apiProfile: MyProfile = {
              fullName:
                user.fullName ||
                [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                seed?.name ||
                "",
              jobTitle: user.jobTitle || "",
              companyName: user.companyName || "",
              email: user.email || seed?.email || "",
              phone: user.phone || "",
              linkedinUrl: user.linkedinUrl || "",
            };
            setProfileState(apiProfile);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(apiProfile));
          }
        }
      } catch {}

      setIsLoaded(true);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = useCallback(async (data: MyProfile) => {
    setProfileState(data);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  return { profile, saveProfile, isLoaded };
}
