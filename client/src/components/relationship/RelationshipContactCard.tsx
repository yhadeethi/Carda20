import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { StoredContact } from "@/lib/contactsStorage";
import { Building, Calendar, MoreHorizontal, Tag, User, Link2 } from "lucide-react";
import { format } from "date-fns";
import { CompanyLinkerDialog } from "./CompanyLinkerDialog";

interface RelationshipContactCardProps {
  contact: StoredContact;
  onOpen: () => void;

  // Optional actions (Relationships list uses these; Scan preview can omit)
  onDelete?: () => void;
  onContactUpdated?: () => void;

  // Optional UI tweaks
  showActionsMenu?: boolean;
  showMeta?: boolean;
}

export function RelationshipContactCard({
  contact,
  onOpen,
  onDelete,
  onContactUpdated,
  showActionsMenu = true,
  showMeta = true,
}: RelationshipContactCardProps) {
  const [showLinker, setShowLinker] = useState(false);
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy");
    } catch {
      return "";
    }
  };

  const isNew = (dateStr: string) => {
    try {
      const d = new Date(dateStr).getTime();
      const days = (Date.now() - d) / (1000 * 60 * 60 * 24);
      return days <= 7;
    } catch {
      return false;
    }
  };

  const displayCompany = (c: StoredContact) => (c.company?.trim() ? c.company.trim() : "Unknown company");
  const displayName = (c: StoredContact) =>
    c.name?.trim() ? c.name.trim() : c.email?.trim() ? c.email.trim() : "Unknown";

  return (
    <div
      className="rounded-2xl border bg-card hover:bg-muted/30 transition shadow-sm cursor-pointer"
      onClick={onOpen}
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      data-testid={`relationship-contact-card-${contact.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      <div className="p-4 flex items-start gap-3">
        {/* Avatar */}
        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* Company-first */}
              <div className="font-semibold leading-5 truncate" title={displayCompany(contact)}>
                {displayCompany(contact)}
              </div>

              {/* Name + title */}
              <div className="text-sm text-muted-foreground mt-0.5 min-w-0 truncate" title={displayName(contact)}>
                <span className="font-medium text-foreground">{displayName(contact)}</span>
                {contact.title ? <span className="text-muted-foreground"> · {contact.title}</span> : null}
              </div>
            </div>

            {/* Actions */}
            {showActionsMenu && (onDelete || true) ? (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-xl opacity-70 hover:opacity-100">
                      <MoreHorizontal className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onOpen}>
                      <User className="w-4 h-4 mr-2" />
                      Open
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLinker(true);
                      }}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Link to Company
                    </DropdownMenuItem>

                    {onDelete ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                          Delete
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>

          {/* Meta row */}
          {showMeta ? (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {contact.createdAt && isNew(contact.createdAt) && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
              )}

              {contact.createdAt ? (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Scanned {formatDate(contact.createdAt)}
                </span>
              ) : null}

              {contact.eventName ? (
                <span
                  className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground inline-flex items-center gap-1 max-w-[220px]"
                  title={contact.eventName}
                >
                  <Tag className="w-3 h-3 shrink-0" />
                  <span className="truncate">{contact.eventName}</span>
                </span>
              ) : null}

              {(contact.company || contact.title) ? (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1 min-w-0">
                  <Building className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[260px]">
                    {[contact.company, contact.title].filter(Boolean).join(" · ")}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Company Linker Dialog */}
      <CompanyLinkerDialog
        contact={contact}
        open={showLinker}
        onOpenChange={setShowLinker}
        onLinked={() => {
          onContactUpdated?.();
        }}
      />
    </div>
  );
}
