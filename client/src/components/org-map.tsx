/**
 * Org Map Component for Org Intelligence MVP
 * Displays organizational hierarchy with seniority-based grouping
 */

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  User,
  ChevronDown,
  MoreVertical,
  Shield,
  Minus,
  AlertTriangle,
  CircleDot,
  Users,
  UserPlus,
  Eye,
  Check,
} from "lucide-react";
import {
  StoredContact,
  updateContact,
  OrgRole,
  InfluenceLevel,
} from "@/lib/contactsStorage";

interface OrgMapProps {
  companyId: string;
  contacts: StoredContact[];
  onContactUpdate: () => void;
  onSelectContact: (contact: StoredContact) => void;
}

type SeniorityBand = 'Exec' | 'Manager' | 'Staff';

// Classify contact into seniority band based on job title
function classifySeniority(title: string | undefined): SeniorityBand {
  if (!title) return 'Staff';
  
  const lowerTitle = title.toLowerCase();
  
  // Exec level
  const execKeywords = ['ceo', 'chief', 'managing director', 'md', 'founder', 'director', 'head', 'president', 'vp', 'vice president', 'partner', 'owner', 'cto', 'cfo', 'coo', 'cmo'];
  if (execKeywords.some((kw) => lowerTitle.includes(kw))) {
    return 'Exec';
  }
  
  // Manager level
  const managerKeywords = ['manager', 'lead', 'principal', 'senior', 'supervisor', 'coordinator', 'team lead'];
  if (managerKeywords.some((kw) => lowerTitle.includes(kw))) {
    return 'Manager';
  }
  
  return 'Staff';
}

export function OrgMap({ companyId, contacts, onContactUpdate, onSelectContact }: OrgMapProps) {
  const [editingContact, setEditingContact] = useState<StoredContact | null>(null);
  const [showManagerPicker, setShowManagerPicker] = useState(false);

  // Group contacts by seniority band
  const groupedContacts = useMemo(() => {
    const groups: Record<SeniorityBand, StoredContact[]> = {
      Exec: [],
      Manager: [],
      Staff: [],
    };
    
    // First, try to build tree from org.reportsToId relationships
    const hasManagerRelationships = contacts.some((c) => c.org?.reportsToId);
    
    if (hasManagerRelationships) {
      // Use org.reportsToId for structure
      const rootContacts = contacts.filter((c) => !c.org?.reportsToId);
      const midContacts = contacts.filter((c) => {
        if (!c.org?.reportsToId) return false;
        // Check if this contact has reports
        return contacts.some((other) => other.org?.reportsToId === c.id);
      });
      const leafContacts = contacts.filter((c) => {
        return c.org?.reportsToId && !contacts.some((other) => other.org?.reportsToId === c.id);
      });
      
      groups.Exec = rootContacts;
      groups.Manager = midContacts;
      groups.Staff = leafContacts;
    } else {
      // Fall back to title-based grouping
      contacts.forEach((c) => {
        const band = classifySeniority(c.title);
        groups[band].push(c);
      });
    }
    
    return groups;
  }, [contacts]);

  const handleSetOrgRole = (contactId: string, role: OrgRole) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      const currentOrg = contact.org || { department: 'UNKNOWN', reportsToId: null, role: 'UNKNOWN', influence: 'UNKNOWN', relationshipStrength: 'UNKNOWN' };
      updateContact(contactId, { org: { ...currentOrg, role } });
      onContactUpdate();
    }
  };

  const handleSetInfluence = (contactId: string, level: InfluenceLevel) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      const currentOrg = contact.org || { department: 'UNKNOWN', reportsToId: null, role: 'UNKNOWN', influence: 'UNKNOWN', relationshipStrength: 'UNKNOWN' };
      updateContact(contactId, { org: { ...currentOrg, influence: level } });
      onContactUpdate();
    }
  };

  const handleSetManager = (contactId: string, managerId: string | null) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      const currentOrg = contact.org || { department: 'UNKNOWN', reportsToId: null, role: 'UNKNOWN', influence: 'UNKNOWN', relationshipStrength: 'UNKNOWN' };
      updateContact(contactId, { org: { ...currentOrg, reportsToId: managerId } });
      setShowManagerPicker(false);
      setEditingContact(null);
      onContactUpdate();
    }
  };

  // Empty state
  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>To build an Org Map, add contacts for this company first.</p>
      </div>
    );
  }

  // Single contact hint
  if (contacts.length === 1) {
    const contact = contacts[0];
    return (
      <div className="space-y-4">
        <OrgNode
          contact={contact}
          allContacts={contacts}
          onSetOrgRole={handleSetOrgRole}
          onSetInfluence={handleSetInfluence}
          onSetManager={(id) => {
            setEditingContact(contact);
            setShowManagerPicker(true);
          }}
          onViewContact={() => onSelectContact(contact)}
        />
        <div className="text-center py-4 text-muted-foreground text-sm">
          <UserPlus className="w-5 h-5 mx-auto mb-2 opacity-50" />
          Add more people from this company to build out the org structure.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Exec Level */}
      {groupedContacts.Exec.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Leadership
          </h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {groupedContacts.Exec.map((contact) => (
              <OrgNode
                key={contact.id}
                contact={contact}
                allContacts={contacts}
                onSetOrgRole={handleSetOrgRole}
                onSetInfluence={handleSetInfluence}
                onSetManager={(id) => {
                  setEditingContact(contact);
                  setShowManagerPicker(true);
                }}
                onViewContact={() => onSelectContact(contact)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Connector Line */}
      {groupedContacts.Exec.length > 0 && groupedContacts.Manager.length > 0 && (
        <div className="flex justify-center">
          <div className="w-px h-6 bg-border" />
        </div>
      )}

      {/* Manager Level */}
      {groupedContacts.Manager.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Managers
          </h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {groupedContacts.Manager.map((contact) => (
              <OrgNode
                key={contact.id}
                contact={contact}
                allContacts={contacts}
                onSetOrgRole={handleSetOrgRole}
                onSetInfluence={handleSetInfluence}
                onSetManager={(id) => {
                  setEditingContact(contact);
                  setShowManagerPicker(true);
                }}
                onViewContact={() => onSelectContact(contact)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Connector Line */}
      {(groupedContacts.Exec.length > 0 || groupedContacts.Manager.length > 0) && groupedContacts.Staff.length > 0 && (
        <div className="flex justify-center">
          <div className="w-px h-6 bg-border" />
        </div>
      )}

      {/* Staff Level */}
      {groupedContacts.Staff.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Team Members
          </h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {groupedContacts.Staff.map((contact) => (
              <OrgNode
                key={contact.id}
                contact={contact}
                allContacts={contacts}
                onSetOrgRole={handleSetOrgRole}
                onSetInfluence={handleSetInfluence}
                onSetManager={(id) => {
                  setEditingContact(contact);
                  setShowManagerPicker(true);
                }}
                onViewContact={() => onSelectContact(contact)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Manager Picker Dialog */}
      <Dialog open={showManagerPicker} onOpenChange={setShowManagerPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Manager for {editingContact?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleSetManager(editingContact!.id, null)}
            >
              <Minus className="w-4 h-4 mr-2" />
              No Manager (Top Level)
            </Button>
            {contacts
              .filter((c) => c.id !== editingContact?.id)
              .map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleSetManager(editingContact!.id, c.id)}
                >
                  <User className="w-4 h-4 mr-2" />
                  <span className="truncate">{c.name}</span>
                  {c.title && (
                    <span className="text-muted-foreground text-xs ml-2 truncate">
                      {c.title}
                    </span>
                  )}
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Individual Org Node Component
interface OrgNodeProps {
  contact: StoredContact;
  allContacts: StoredContact[];
  onSetOrgRole: (contactId: string, role: OrgRole) => void;
  onSetInfluence: (contactId: string, level: InfluenceLevel) => void;
  onSetManager: (contactId: string) => void;
  onViewContact: () => void;
}

function OrgNode({ contact, allContacts, onSetOrgRole, onSetInfluence, onSetManager, onViewContact }: OrgNodeProps) {
  const roleConfig: Record<OrgRole, { icon: typeof Shield; color: string }> = {
    CHAMPION: { icon: Shield, color: "text-green-600 dark:text-green-400" },
    NEUTRAL: { icon: Minus, color: "text-gray-500" },
    BLOCKER: { icon: AlertTriangle, color: "text-red-600 dark:text-red-400" },
    UNKNOWN: { icon: CircleDot, color: "text-gray-400" },
  };

  const influenceColors: Record<InfluenceLevel, string> = {
    HIGH: "border-orange-400",
    MEDIUM: "border-yellow-400",
    LOW: "border-blue-400",
    UNKNOWN: "border-border",
  };

  const RoleIcon = roleConfig[contact.org?.role || 'UNKNOWN'].icon;
  const roleColor = roleConfig[contact.org?.role || 'UNKNOWN'].color;
  const borderColor = influenceColors[contact.org?.influence || 'UNKNOWN'];

  // Find manager name
  const manager = contact.org?.reportsToId
    ? allContacts.find((c) => c.id === contact.org?.reportsToId)
    : null;

  return (
    <Card className={`w-40 border-2 ${borderColor} hover-elevate`} data-testid={`org-node-${contact.id}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate" title={contact.name}>
              {contact.name || "Unknown"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate" title={contact.title}>
              {contact.title || "No title"}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0">
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onViewContact}>
                <Eye className="w-4 h-4 mr-2" />
                View Full Contact
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSetManager(contact.id)}>
                <User className="w-4 h-4 mr-2" />
                Set Manager
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px]">Org Role</DropdownMenuLabel>
              {(['CHAMPION', 'NEUTRAL', 'BLOCKER', 'UNKNOWN'] as OrgRole[]).map((role) => (
                <DropdownMenuItem
                  key={role}
                  onClick={() => onSetOrgRole(contact.id, role)}
                >
                  {contact.org?.role === role && <Check className="w-4 h-4 mr-2" />}
                  {contact.org?.role !== role && <span className="w-4 mr-2" />}
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </DropdownMenuItem>
              ))}
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px]">Influence</DropdownMenuLabel>
              {(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as InfluenceLevel[]).map((level) => (
                <DropdownMenuItem
                  key={level}
                  onClick={() => onSetInfluence(contact.id, level)}
                >
                  {contact.org?.influence === level && <Check className="w-4 h-4 mr-2" />}
                  {contact.org?.influence !== level && <span className="w-4 mr-2" />}
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Role and Influence chips */}
        <div className="flex items-center gap-1 flex-wrap">
          {contact.org?.role && contact.org.role !== 'UNKNOWN' && (
            <div className={`flex items-center gap-0.5 ${roleColor}`}>
              <RoleIcon className="w-3 h-3" />
              <span className="text-[9px] font-medium">{contact.org.role.charAt(0) + contact.org.role.slice(1).toLowerCase()}</span>
            </div>
          )}
          {contact.org?.influence && contact.org.influence !== 'UNKNOWN' && (
            <span className="text-[9px] text-muted-foreground">
              {contact.org.influence.charAt(0) + contact.org.influence.slice(1).toLowerCase()}
            </span>
          )}
        </div>

        {/* Manager indicator */}
        {manager && (
          <p className="text-[9px] text-muted-foreground truncate">
            Reports to: {manager.name}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
