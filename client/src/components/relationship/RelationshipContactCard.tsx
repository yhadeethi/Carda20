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
import { Building, MoreHorizontal, Tag, User, Link2 } from "lucide-react";
import { CompanyLinkerDialog } from "./CompanyLinkerDialog";

export type StripeStatus = "overdue" | "due-today" | "new" | "default";

interface RelationshipContactCardProps {
  contact: StoredContact;
  onOpen: () => void;
  onDelete?: () => void;
  onContactUpdated?: () => void;
  showActionsMenu?: boolean;
  showMeta?: boolean;
  stripeStatus?: StripeStatus;
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  } else if (words.length === 1) {
    return trimmed.slice(0, 2).toUpperCase();
  }
  return "?";
}

function stripeColorFromStatus(status: StripeStatus): string {
  switch (status) {
    case "overdue":   return "bg-red-500";
    case "due-today": return "bg-amber-400";
    case "new":       return "bg-[#4B68F5]";
    default:          return "bg-black/10";
  }
}

function deriveStripeStatus(contact: StoredContact): StripeStatus {
  if (contact.createdAt) {
    try {
      const days = (Date.now() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (days <= 7) return "new";
    } catch {
      // fall through
    }
  }
  return "default";
}

export function RelationshipContactCard({
  contact,
  onOpen,
  onDelete,
  onContactUpdated,
  showActionsMenu = true,
  showMeta = true,
  stripeStatus,
}: RelationshipContactCardProps) {
  const [showLinker, setShowLinker] = useState(false);
  const resolvedStatus = stripeStatus ?? deriveStripeStatus(contact);

  const isNew = (dateStr: string) => {
    try {
      const d = new Date(dateStr).getTime();
      const days = (Date.now() - d) / (1000 * 60 * 60 * 24);
      return days <= 7;
    } catch {
      return false;
    }
  };

  const personName = contact.name?.trim() || contact.email?.trim() || "Unknown";
  const initials = getInitials(personName);
  const stripeColor = stripeColorFromStatus(resolvedStatus);

  return (
    <div
      className="relative bg-white rounded-xl border border-black/10 shadow-sm overflow-hidden active:opacity-75 transition-opacity cursor-pointer"
      onClick={onOpen}
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      data-testid={`relationship-contact-card-${contact.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      {/* Status stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${stripeColor}`} />

      <div className="p-3 pl-4 flex items-start gap-3">
        {/* Monochrome initials avatar — circle for people */}
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-extrabold select-none bg-black/5 text-[#3A3A3F]"
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Name */}
              <div
                className="text-[14px] font-bold text-foreground leading-5 truncate"
                title={personName}
                data-testid={`text-contact-name-${contact.id}`}
              >
                {personName}
              </div>

              {/* Title */}
              {contact.title?.trim() ? (
                <div
                  className="text-[12px] font-medium text-muted-foreground mt-0.5 truncate"
                  title={contact.title.trim()}
                  data-testid={`text-contact-title-${contact.id}`}
                >
                  {contact.title.trim()}
                </div>
              ) : null}

              {/* Company */}
              {contact.company?.trim() ? (
                <div
                  className="text-[12px] font-medium text-muted-foreground mt-0.5 inline-flex items-center gap-1 min-w-0 truncate"
                  title={contact.company}
                  data-testid={`text-contact-company-${contact.id}`}
                >
                  <Building className="w-3 h-3 shrink-0" />
                  <span className="truncate">{contact.company.trim()}</span>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            {showActionsMenu ? (
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
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[#4B68F5]/10 text-[#4B68F5]">
                  New
                </span>
              )}

              {contact.eventName ? (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/5 text-muted-foreground/70 inline-flex items-center gap-1 max-w-[220px]"
                  title={contact.eventName}
                >
                  <Tag className="w-3 h-3 shrink-0" />
                  <span className="truncate">{contact.eventName}</span>
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
