/**
 * Upcoming View
 * Shows upcoming reminders across all contacts
 */

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, User, Calendar, ArrowRight } from "lucide-react";
import { getAllUpcomingReminders, loadContactsV2 } from "@/lib/contacts/storage";
import { format, formatDistanceToNow, isToday, isTomorrow, isThisWeek } from "date-fns";

interface UpcomingViewProps {
  onSelectContact: (contactId: string) => void;
}

export function UpcomingView({ onSelectContact }: UpcomingViewProps) {
  const upcoming = useMemo(() => getAllUpcomingReminders(20), []);

  const groupedReminders = useMemo(() => {
    const today: typeof upcoming = [];
    const tomorrow: typeof upcoming = [];
    const thisWeek: typeof upcoming = [];
    const later: typeof upcoming = [];

    upcoming.forEach(item => {
      const date = new Date(item.reminder.remindAt);
      if (isToday(date)) {
        today.push(item);
      } else if (isTomorrow(date)) {
        tomorrow.push(item);
      } else if (isThisWeek(date)) {
        thisWeek.push(item);
      } else {
        later.push(item);
      }
    });

    return { today, tomorrow, thisWeek, later };
  }, [upcoming]);

  if (upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <Bell className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-lg font-medium text-muted-foreground">No upcoming reminders</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Add reminders to contacts to see them here
        </p>
      </div>
    );
  }

  const ReminderGroup = ({
    title,
    items,
    variant = "default",
  }: {
    title: string;
    items: typeof upcoming;
    variant?: "urgent" | "default";
  }) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
          {title}
        </h3>
        <div className="space-y-2">
          {items.map(item => (
            <Card
              key={item.reminder.id}
              className={`cursor-pointer hover-elevate transition-all ${
                variant === "urgent" ? "border-orange-200 dark:border-orange-800" : ""
              }`}
              onClick={() => onSelectContact(item.contactId)}
              data-testid={`upcoming-reminder-${item.reminder.id}`}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${
                    variant === "urgent" 
                      ? "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400"
                      : "bg-muted"
                  }`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.reminder.label}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground truncate">
                        {item.contactName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.reminder.remindAt), 'PPp')}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <ReminderGroup title="Today" items={groupedReminders.today} variant="urgent" />
        <ReminderGroup title="Tomorrow" items={groupedReminders.tomorrow} />
        <ReminderGroup title="This Week" items={groupedReminders.thisWeek} />
        <ReminderGroup title="Later" items={groupedReminders.later} />
      </div>
    </ScrollArea>
  );
}
