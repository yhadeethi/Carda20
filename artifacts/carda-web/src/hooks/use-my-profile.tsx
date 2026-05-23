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
    linkedinUrl = "",
  } = profile || {};

  const { firstName, lastName } = splitName(fullName);

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    fullName ? `N:${lastName};${firstName};;;` : "",
    fullName ? `FN:${fullName}` : "",
    jobTitle ? `TITLE:${jobTitle}` : "",
    companyName ? `ORG:${companyName}` : "",
  ];

  // LinkedIn as primary URL (item1) if present
  if (linkedinUrl) {
    lines.push(`item1.URL;type=pref:${linkedinUrl}`);
    lines.push("item1.X-ABLabel:LinkedIn");
  }

  // Website as secondary URL (item2) if LinkedIn exists, otherwise as primary URL
  if (website) {
    if (linkedinUrl) {
      lines.push(`item2.URL;type=WORK:${website}`);
      lines.push("item2.X-ABLabel:Work Website");
    } else {
      lines.push(`URL:${website}`);
    }
  }

  // Add remaining fields
  if (phone) lines.push(`TEL;TYPE=mobile:${phone}`);
  if (email) lines.push(`EMAIL:${email}`);
  if (street || city || state || postcode || country) {
    lines.push(`ADR;TYPE=WORK:;;${street};${city};${state};${postcode};${country}`);
  }

  lines.push("END:VCARD");

  return lines.filter(Boolean).join("\n");
}
