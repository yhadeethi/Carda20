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
import { getContactById } from "@/lib/contacts/storage";

interface RelationshipContactCardProps {
  contact: StoredContact;
  onOpen: () => void;
  onDelete?: () => void;
  onContactUpdated?: () => void;
  showActionsMenu?: boolean;
  showMeta?: boolean;
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

function getStripeColor(contact: StoredContact): string {
  try {
    const v2 = getContactById(contact.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (v2) {
      const hasOverdue =
        v2.tasks?.some((t: any) => !t.done && t.dueAt && new Date(t.dueAt) < today) ||
        v2.reminders?.some((r: any) => !r.done && new Date(r.remindAt) < today);
      if (hasOverdue) return "bg-red-500";

      const isDueToday =
        v2.tasks?.some(
          (t: any) => !t.done && t.dueAt && new Date(t.dueAt) >= today && new Date(t.dueAt) < tomorrow
        ) ||
        v2.reminders?.some(
          (r: any) => !r.done && new Date(r.remindAt) >= today && new Date(r.remindAt) < tomorrow
        );
      if (isDueToday) return "bg-amber-400";
    }
  } catch {
    // fall through to default
  }

  if (contact.createdAt) {
    try {
      const days = (Date.now() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (days <= 7) return "bg-[#4B68F5]";
    } catch {
      // fall through
    }
  }

  return "bg-black/10";
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

  const personName = contact.name?.trim() || contact.email?.trim() || "Unknown";
  const initials = getInitials(personName);
  const stripeColor = getStripeColor(contact);

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

      <div className="p-4 pl-5 flex items-start gap-3">
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

              {contact.createdAt ? (
                <span className="text-[11px] font-semibold text-muted-foreground/60 inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Scanned {formatDate(contact.createdAt)}
                </span>
              ) : null}

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
