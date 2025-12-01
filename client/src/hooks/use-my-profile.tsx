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

/**
 * Split a full name into first and last name parts
 * Handles common patterns:
 * - "John Doe" -> { firstName: "John", lastName: "Doe" }
 * - "John Michael Doe" -> { firstName: "John Michael", lastName: "Doe" }
 * - "John" -> { firstName: "John", lastName: "" }
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }
  
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(" ");
  return { firstName, lastName };
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

  const { firstName, lastName } = splitName(fullName);

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    fullName ? `N:${lastName};${firstName};;;` : "",
    fullName ? `FN:${fullName}` : "",
    jobTitle ? `TITLE:${jobTitle}` : "",
    companyName ? `ORG:${companyName}` : "",
    phone ? `TEL;TYPE=mobile:${phone}` : "",
    email ? `EMAIL:${email}` : "",
    (street || city || state || postcode || country)
      ? `ADR;TYPE=WORK:;;${street};${city};${state};${postcode};${country}`
      : "",
    website ? `URL:${website}` : "",
    "END:VCARD",
  ];

  return lines.filter(Boolean).join("\n");
}
