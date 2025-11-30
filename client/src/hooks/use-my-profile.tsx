import { useState, useEffect, useCallback } from "react";

export interface MyProfile {
  fullName: string;
  companyName: string;
  jobTitle: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  website: string;
  linkedinUrl: string;
}

const STORAGE_KEY = "carda_my_profile";

const DEFAULT_PROFILE: MyProfile = {
  fullName: "",
  companyName: "",
  jobTitle: "",
  phone: "",
  email: "",
  street: "",
  city: "",
  state: "",
  postcode: "",
  country: "",
  website: "",
  linkedinUrl: "",
};

export function useMyProfile() {
  const [profile, setProfileState] = useState<MyProfile>(DEFAULT_PROFILE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setProfileState({ ...DEFAULT_PROFILE, ...parsed });
      }
    } catch (e) {
      console.error("Failed to load profile from localStorage:", e);
    }
    setIsLoaded(true);
  }, []);

  const setProfile = useCallback((updates: Partial<MyProfile>) => {
    setProfileState((prev) => {
      const updated = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save profile to localStorage:", e);
      }
      return updated;
    });
  }, []);

  const hasProfile = Boolean(profile.fullName || profile.email || profile.phone);

  return { profile, setProfile, hasProfile, isLoaded };
}

export function generateVCardFromProfile(profile: MyProfile): string {
  const {
    fullName = "",
    companyName = "",
    jobTitle = "",
    phone = "",
    email = "",
    street = "",
    city = "",
    state = "",
    postcode = "",
    country = "",
    website = "",
  } = profile || {};

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    fullName ? `FN:${fullName}` : "",
    companyName ? `ORG:${companyName}` : "",
    jobTitle ? `TITLE:${jobTitle}` : "",
    phone ? `TEL;TYPE=CELL:${phone}` : "",
    email ? `EMAIL:${email}` : "",
    (street || city || state || postcode || country)
      ? `ADR;TYPE=WORK:;;${street};${city};${state};${postcode};${country}`
      : "",
    website ? `URL:${website}` : "",
    "END:VCARD",
  ];

  return lines.filter(Boolean).join("\n");
}
