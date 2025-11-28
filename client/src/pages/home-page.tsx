import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { ScanTab } from "@/components/scan-tab";
import { MyCardTab } from "@/components/my-card-tab";
import { Button } from "@/components/ui/button";
import { Scan, CreditCard, Moon, Sun, LogOut } from "lucide-react";

type ActiveTab = "scan" | "mycard";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("scan");
  const { logoutMutation } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">Carda</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === "scan" ? <ScanTab /> : <MyCardTab />}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 tab-bar safe-area-bottom flex items-center justify-around px-4 z-50">
        <button
          onClick={() => setActiveTab("scan")}
          className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-smooth ${
            activeTab === "scan"
              ? "text-primary"
              : "text-muted-foreground"
          }`}
          data-testid="tab-scan"
        >
          <Scan className={`w-6 h-6 ${activeTab === "scan" ? "text-primary" : ""}`} />
          <span className={`text-xs font-medium ${activeTab === "scan" ? "font-semibold" : ""}`}>
            Scan
          </span>
          {activeTab === "scan" && (
            <div className="absolute bottom-1 w-8 h-1 bg-primary rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("mycard")}
          className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-smooth ${
            activeTab === "mycard"
              ? "text-primary"
              : "text-muted-foreground"
          }`}
          data-testid="tab-mycard"
        >
          <CreditCard className={`w-6 h-6 ${activeTab === "mycard" ? "text-primary" : ""}`} />
          <span className={`text-xs font-medium ${activeTab === "mycard" ? "font-semibold" : ""}`}>
            My Card
          </span>
          {activeTab === "mycard" && (
            <div className="absolute bottom-1 w-8 h-1 bg-primary rounded-full" />
          )}
        </button>
      </nav>
    </div>
  );
}
