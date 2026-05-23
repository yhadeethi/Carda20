/**
 * Carda brand design tokens — converted from carda-web/src/index.css CSS variables.
 *
 * Dark mode values (primary theme):
 *   background: HSL 222 47% 8%  → #0B111E
 *   card:       HSL 222 47% 11% → #0F1729
 *   primary:    HSL 217 91% 60% → #3C83F6 (logo uses #4B68F5)
 *   border:     HSL 217 33% 17% → #1D283A
 *   muted fg:   HSL 215 20% 65% → #94A2B8
 *
 * Logo gradient: #4B68F5 → #7B5CF0
 */

const colors = {
  light: {
    text: "#111E36",
    tint: "#4B68F5",
    background: "#F5F6FA",
    foreground: "#111E36",
    card: "#FFFFFF",
    cardForeground: "#111E36",
    primary: "#4B68F5",
    primaryForeground: "#FFFFFF",
    secondary: "#F0F2F7",
    secondaryForeground: "#111E36",
    muted: "#F0F2F7",
    mutedForeground: "#6B7280",
    accent: "#4B68F5",
    accentForeground: "#FFFFFF",
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",
    border: "#E3E6EF",
    input: "#E3E6EF",
    glassBg: "rgba(255,255,255,0.7)",
    glassBorder: "rgba(255,255,255,0.3)",
    purple: "#7B5CF0",
    gradientStart: "#4B68F5",
    gradientEnd: "#7B5CF0",
  },
  dark: {
    text: "#F5F9FF",
    tint: "#4B68F5",
    background: "#0B111E",
    foreground: "#F5F9FF",
    card: "#0F1729",
    cardForeground: "#F5F9FF",
    primary: "#4B68F5",
    primaryForeground: "#FFFFFF",
    secondary: "#1D283A",
    secondaryForeground: "#F5F9FF",
    muted: "#1D283A",
    mutedForeground: "#94A2B8",
    accent: "#4B68F5",
    accentForeground: "#FFFFFF",
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",
    border: "#1D283A",
    input: "#2B3B54",
    glassBg: "rgba(30,41,59,0.7)",
    glassBorder: "rgba(255,255,255,0.1)",
    purple: "#7B5CF0",
    gradientStart: "#4B68F5",
    gradientEnd: "#7B5CF0",
  },
  radius: 12,
};

export default colors;
