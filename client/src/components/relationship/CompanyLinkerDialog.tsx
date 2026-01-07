/**
 * Company Linker Dialog - Link contacts to companies manually
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
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => {
          // Prevent dialog from closing when interacting with Select dropdown
          const target = e.target as HTMLElement;
          if (target.closest('[role="listbox"]') || target.closest('[data-radix-select-content]')) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
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
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{currentCompany.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnlink}
                className="h-7 text-xs hover:bg-destructive/10 hover:text-destructive"
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
              className="pl-9"
            />
          </div>

          {/* Company Selector */}
          <Select value={selectedCompanyId || ""} onValueChange={setSelectedCompanyId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {filteredCompanies.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No companies found
                </div>
              ) : (
                filteredCompanies.map((company) => (
                  <SelectItem
                    key={company.id}
                    value={company.id}
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
          >
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedCompanyId}
          >
            <Link2 className="w-4 h-4 mr-2" />
            Link Company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
