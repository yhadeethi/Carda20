/**
 * Company Linker Dialog - Link contacts to companies manually
 * Features liquid glass morphing effects (Apple-style)
 */

import { useState, useMemo } from "react";
import { StoredContact, updateContact } from "@/lib/contactsStorage";
import { Company, getCompanies } from "@/lib/companiesStorage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Link2, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompanyLinkerDialogProps {
  contact: StoredContact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: () => void;
}

export function CompanyLinkerDialog({
  contact,
  open,
  onOpenChange,
  onLinked,
}: CompanyLinkerDialogProps) {
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    contact.companyId || null
  );
  const [searchQuery, setSearchQuery] = useState("");

  const companies = useMemo(() => getCompanies(), [open]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const query = searchQuery.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.domain?.toLowerCase().includes(query)
    );
  }, [companies, searchQuery]);

  const handleLink = () => {
    if (!selectedCompanyId) {
      toast({
        title: "No company selected",
        description: "Please select a company to link",
        variant: "destructive",
      });
      return;
    }

    const updated = updateContact(contact.id, { companyId: selectedCompanyId });

    if (updated) {
      const company = companies.find((c) => c.id === selectedCompanyId);
      toast({
        title: "Contact linked",
        description: `${contact.name} is now linked to ${company?.name}`,
      });
      onLinked?.();
      onOpenChange(false);
    } else {
      toast({
        title: "Failed to link",
        description: "Could not link contact to company",
        variant: "destructive",
      });
    }
  };

  const handleUnlink = () => {
    const updated = updateContact(contact.id, { companyId: null });

    if (updated) {
      toast({
        title: "Contact unlinked",
        description: `${contact.name} has been unlinked from all companies`,
      });
      setSelectedCompanyId(null);
      onLinked?.();
      onOpenChange(false);
    }
  };

  const currentCompany = selectedCompanyId
    ? companies.find((c) => c.id === selectedCompanyId)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="backdrop-blur-2xl bg-background/90 border border-border/50 shadow-2xl sm:max-w-[500px]"
        style={{
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Link to Company
          </DialogTitle>
          <DialogDescription>
            Link <span className="font-medium text-foreground">{contact.name}</span> to a company
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Company Display */}
          {currentCompany && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{currentCompany.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnlink}
                className="h-7 text-xs hover:bg-destructive/10 hover:text-destructive transition-all duration-200 hover:scale-105"
              >
                <X className="w-3 h-3 mr-1" />
                Unlink
              </Button>
            </div>
          )}

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl backdrop-blur-xl bg-background/60 border-border/50 focus:bg-background/80 transition-all"
              style={{
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            />
          </div>

          {/* Company Selector */}
          <Select value={selectedCompanyId || ""} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className="rounded-xl backdrop-blur-xl bg-background/60 border-border/50 hover:bg-background/80 transition-all">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent className="backdrop-blur-2xl bg-background/95 border-border/50">
              {filteredCompanies.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No companies found
                </div>
              ) : (
                filteredCompanies.map((company) => (
                  <SelectItem
                    key={company.id}
                    value={company.id}
                    className="cursor-pointer hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="font-medium">{company.name}</span>
                        {company.domain && (
                          <span className="text-xs text-muted-foreground">{company.domain}</span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {companies.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No companies available. Companies are auto-generated from contacts.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl transition-all duration-200 hover:scale-105"
          >
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedCompanyId}
            className="rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105"
          >
            <Link2 className="w-4 h-4 mr-2" />
            Link Company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
