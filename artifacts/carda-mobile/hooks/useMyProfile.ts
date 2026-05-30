import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

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
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      let loaded = empty();
      if (stored) {
        try {
          loaded = { ...empty(), ...(JSON.parse(stored) as Partial<MyProfile>) };
        } catch {}
      }
      if (!loaded.fullName && seed?.name) loaded.fullName = seed.name;
      if (!loaded.email && seed?.email) loaded.email = seed.email;
      setProfileState(loaded);
      setIsLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = useCallback(async (data: MyProfile) => {
    setProfileState(data);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  return { profile, saveProfile, isLoaded };
}
