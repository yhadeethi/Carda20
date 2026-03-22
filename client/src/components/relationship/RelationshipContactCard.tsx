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

  onDelete?: () => void;
  onContactUpdated?: () => void;

  showActionsMenu?: boolean;
  showMeta?: boolean;
}

const AVATAR_COLORS = [
  ["#3B82F6", "#EFF6FF"],
  ["#8B5CF6", "#F5F3FF"],
  ["#10B981", "#ECFDF5"],
  ["#F59E0B", "#FFFBEB"],
  ["#EF4444", "#FEF2F2"],
  ["#06B6D4", "#ECFEFF"],
  ["#F97316", "#FFF7ED"],
  ["#84CC16", "#F7FEE7"],
  ["#EC4899", "#FDF2F8"],
  ["#6366F1", "#EEF2FF"],
];

function getInitialsAndColor(name: string): { initials: string; bg: string; fg: string } {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  let initials = "";
  if (words.length >= 2) {
    initials = (words[0][0] + words[words.length - 1][0]).toUpperCase();
  } else if (words.length === 1) {
    initials = trimmed.slice(0, 2).toUpperCase();
  } else {
    initials = "?";
  }

  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  const [fg, bg] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return { initials, bg, fg };
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
  const { initials, bg, fg } = getInitialsAndColor(personName);

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
        {/* Initials avatar */}
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-semibold select-none"
          style={{ backgroundColor: bg, color: fg }}
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Person name — primary headline */}
              <div
                className="font-semibold leading-5 truncate"
                title={personName}
                data-testid={`text-contact-name-${contact.id}`}
              >
                {personName}
              </div>

              {/* Title — secondary line */}
              {contact.title?.trim() ? (
                <div
                  className="text-sm text-muted-foreground mt-0.5 truncate"
                  title={contact.title.trim()}
                  data-testid={`text-contact-title-${contact.id}`}
                >
                  {contact.title.trim()}
                </div>
              ) : null}

              {/* Company — tertiary line */}
              {contact.company?.trim() ? (
                <div
                  className="text-xs text-muted-foreground/80 mt-0.5 inline-flex items-center gap-1 min-w-0 truncate"
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

          {/* Meta row — scan date + event tag only */}
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
