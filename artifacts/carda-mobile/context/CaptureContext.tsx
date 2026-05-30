import React, { createContext, useContext, useState } from "react";

type SheetMode = "menu" | "paste" | "qr" | "voice";

interface CaptureContextValue {
  isOpen: boolean;
  openCapture: (mode?: SheetMode) => void;
  closeCapture: () => void;
  initialMode: SheetMode;
}

const CaptureContext = createContext<CaptureContextValue>({
  isOpen: false,
  openCapture: () => {},
  closeCapture: () => {},
  initialMode: "menu",
});

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<SheetMode>("menu");

  const openCapture = (mode: SheetMode = "menu") => {
    setInitialMode(mode);
    setIsOpen(true);
  };

  const closeCapture = () => {
    setIsOpen(false);
    setInitialMode("menu");
  };

  return (
    <CaptureContext.Provider value={{ isOpen, openCapture, closeCapture, initialMode }}>
      {children}
    </CaptureContext.Provider>
  );
}

export function useCapture() {
  return useContext(CaptureContext);
}
