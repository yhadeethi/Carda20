import { useState, useRef } from "react";
import { useNavigate } from "wouter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useContacts } from "@/hooks/useContacts";
import { useCompanies } from "@/hooks/useCompanies";
import { MoreVertical } from "lucide-react";

export default function ContactsHub() {
  const navigate = useNavigate();
  const { contacts } = useContacts();
  const { companies, deleteCompany } = useCompanies();

  const [activeTab, setActiveTab] = useState<"people" | "companies">("people");
  const [searchQuery, setSearchQuery] = useState("");
  const [longPressCompanyId, setLongPressCompanyId] = useState<string | null>(
    null
  );

  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const filteredContacts = contacts.filter((c) =>
    `${c.name} ${c.company}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCompanyPressStart = (companyId: string) => {
    pressTimerRef.current = setTimeout(() => {
      setLongPressCompanyId(companyId);
    }, 500);
  };

  const handleCompanyPressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <p className="text-sm text-muted-foreground">
          All your scanned contacts in one place. Search by name or company.
        </p>

        {/* PEOPLE / COMPANIES TOGGLE */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="mt-4"
        >
          <TabsList className="relative h-14 w-full rounded-full bg-muted p-1">
            <TabsTrigger
              value="people"
              className="relative flex-1 min-w-0 h-12 rounded-full px-4 text-base font-medium"
            >
              People
            </TabsTrigger>
            <TabsTrigger
              value="companies"
              className="relative flex-1 min-w-0 h-12 rounded-full px-4 text-base font-medium"
            >
              Companies
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* SEARCH */}
        <div className="relative mt-4">
          <Input
            placeholder={
              activeTab === "people"
                ? "Search by name or company..."
                : "Search companies..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-2xl h-11"
          />
        </div>
      </CardHeader>

      {/* LIST */}
      <div className="px-4 pb-4 space-y-2">
        {activeTab === "people" &&
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => navigate(`/contacts/${contact.id}`)}
              className="rounded-xl border p-3 cursor-pointer hover:bg-muted"
            >
              <div className="font-medium">{contact.name}</div>
              <div className="text-sm text-muted-foreground">
                {contact.company}
              </div>
            </div>
          ))}

        {activeTab === "companies" &&
          filteredCompanies.map((company) => (
            <div
              key={company.id}
              onTouchStart={() => handleCompanyPressStart(String(company.id))}
              onTouchEnd={handleCompanyPressEnd}
              onMouseDown={() => handleCompanyPressStart(String(company.id))}
              onMouseUp={handleCompanyPressEnd}
              onClick={() => navigate(`/companies/${company.id}`)}
              className="relative rounded-xl border p-3 cursor-pointer hover:bg-muted"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{company.name}</div>

                <DropdownMenu
                  open={longPressCompanyId === String(company.id)}
                  onOpenChange={(open) =>
                    !open && setLongPressCompanyId(null)
                  }
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLongPressCompanyId(String(company.id));
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            "Delete this company? Contacts will be unlinked."
                          )
                        ) {
                          deleteCompany(String(company.id));
                        }
                      }}
                    >
                      Delete company
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
      </div>
    </Card>
  );
}
