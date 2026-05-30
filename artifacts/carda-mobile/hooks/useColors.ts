import { lightColors, darkColors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

export function useColors() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? darkColors : lightColors;
}
