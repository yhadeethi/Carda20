/**
 * Contact Actions Tab
 * Follow-up generator, reminders, and tasks for a contact
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  MessageCircle,
  CalendarPlus,
  Bell,
  CheckSquare,
  Copy,
  Save,
  Plus,
  Clock,
  Sparkles,
  Download,
} from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { ContactV2, addTask, completeTask, deleteTask, addReminder, completeReminder, addTimelineEvent } from "@/lib/contacts/storage";
import { ContactTask, ContactReminder, FollowUpMode, FollowUpTone, FollowUpLength } from "@/lib/contacts/types";
import { generateFollowUp, FOLLOWUP_MODE_LABELS, FOLLOWUP_TONE_LABELS, FOLLOWUP_LENGTH_LABELS } from "@/lib/followup/followup";
import { createMeetingWithContact, downloadIcsFile, getQuickTimeSlots } from "@/lib/calendar/ics";
import { addDays, format, addHours, setHours, setMinutes } from "date-fns";

interface ContactActionsTabProps {
  contact: ContactV2;
  onUpdate: () => void;
}

export function ContactActionsTab({ contact, onUpdate }: ContactActionsTabProps) {
  const { toast } = useToast();
  
  // Follow-up state
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpMode, setFollowUpMode] = useState<FollowUpMode>("email_followup");
  const [followUpTone, setFollowUpTone] = useState<FollowUpTone>("friendly");
  const [followUpGoal, setFollowUpGoal] = useState("");
  const [followUpContext, setFollowUpContext] = useState("");
  const [followUpLength, setFollowUpLength] = useState<FollowUpLength>("medium");
  const [generatedFollowUp, setGeneratedFollowUp] = useState<{ subject?: string; body: string; bullets: string[] } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Task state
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  
  // Reminder state
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newReminderLabel, setNewReminderLabel] = useState("");
  const [newReminderDate, setNewReminderDate] = useState("");
  
  // Meeting state
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(30);
  const [customMeetingTime, setCustomMeetingTime] = useState("");
  
  const quickTimeSlots = useMemo(() => getQuickTimeSlots(), []);
  
  // Reminder quick options
  const reminderQuickOptions = useMemo(() => [
    { label: "Tomorrow", getDays: () => 1 },
    { label: "3 days", getDays: () => 3 },
    { label: "1 week", getDays: () => 7 },
    { label: "2 weeks", getDays: () => 14 },
  ], []);

  const handleGenerateFollowUp = async () => {
    setIsGenerating(true);
    try {
      const result = await generateFollowUp(
        {
          name: contact.name,
          company: contact.company,
          title: contact.title,
          email: contact.email,
        },
        {
          mode: followUpMode,
          tone: followUpTone,
          goal: followUpGoal,
          context: followUpContext,
          length: followUpLength,
        }
      );
      setGeneratedFollowUp(result);
      
      // Add timeline event
      addTimelineEvent(
        contact.id,
        'followup_generated',
        `Generated ${FOLLOWUP_MODE_LABELS[followUpMode]} (${followUpTone} tone)`,
        {
          mode: followUpMode,
          tone: followUpTone,
          goal: followUpGoal,
          length: followUpLength,
          subject: result.subject,
          bodyPreview: result.body.slice(0, 100),
        }
      );
      
      onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate follow-up",
        variant: "destructive",
      });
    }
    setIsGenerating(false);
  };

  const handleCopyFollowUp = () => {
    if (!generatedFollowUp) return;
    const text = generatedFollowUp.subject 
      ? `Subject: ${generatedFollowUp.subject}\n\n${generatedFollowUp.body}`
      : generatedFollowUp.body;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    addTask(contact.id, newTaskTitle.trim(), newTaskDueDate || undefined);
    setNewTaskTitle("");
    setNewTaskDueDate("");
    setShowAddTask(false);
    onUpdate();
    toast({ title: "Task added" });
  };

  const handleCompleteTask = (taskId: string) => {
    completeTask(contact.id, taskId);
    onUpdate();
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(contact.id, taskId);
    onUpdate();
  };

  const handleAddReminder = (daysFromNow?: number) => {
    const label = newReminderLabel.trim() || `Follow up with ${contact.name}`;
    let remindAt: string;
    
    if (daysFromNow !== undefined) {
      remindAt = addDays(new Date(), daysFromNow).toISOString();
    } else if (newReminderDate) {
      remindAt = new Date(newReminderDate).toISOString();
    } else {
      remindAt = addDays(new Date(), 1).toISOString();
    }
    
    addReminder(contact.id, label, remindAt);
    setNewReminderLabel("");
    setNewReminderDate("");
    setShowAddReminder(false);
    onUpdate();
    toast({ title: "Reminder set" });
  };

  const handleCompleteReminder = (reminderId: string) => {
    completeReminder(contact.id, reminderId);
    onUpdate();
  };

  const handleScheduleMeeting = (startTime: Date) => {
    const icsContent = createMeetingWithContact(
      contact.name,
      contact.company,
      contact.email,
      startTime,
      meetingDuration
    );
    
    const filename = `meeting-${contact.name.replace(/\s+/g, '-').toLowerCase()}.ics`;
    downloadIcsFile(icsContent, filename);
    
    addTimelineEvent(
      contact.id,
      'meeting_scheduled',
      `Meeting scheduled for ${format(startTime, 'PPp')}`,
      { startTime: startTime.toISOString(), duration: meetingDuration }
    );
    
    setShowScheduleMeeting(false);
    onUpdate();
    toast({ title: "Calendar file downloaded" });
  };

  const handleCustomMeetingTime = () => {
    if (!customMeetingTime) return;
    const startTime = new Date(customMeetingTime);
    handleScheduleMeeting(startTime);
    setCustomMeetingTime("");
  };

  // Sort tasks and reminders
  const pendingTasks = (contact.tasks || []).filter(t => !t.done);
  const completedTasks = (contact.tasks || []).filter(t => t.done);
  const pendingReminders = (contact.reminders || []).filter(r => !r.done).sort((a, b) => a.remindAt.localeCompare(b.remindAt));
  const completedReminders = (contact.reminders || []).filter(r => r.done);

  return (
    <div className="space-y-4 p-4">
      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFollowUp(true)}
              data-testid="button-generate-followup"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Follow-Up
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddReminder(true)}
              data-testid="button-add-reminder"
            >
              <Bell className="w-4 h-4 mr-2" />
              Add Reminder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddTask(true)}
              data-testid="button-add-task"
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              Add Task
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScheduleMeeting(true)}
              data-testid="button-schedule-meeting"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Schedule Meeting
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reminders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Reminders
            {pendingReminders.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {pendingReminders.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingReminders.length === 0 && completedReminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reminders yet</p>
          ) : (
            <div className="space-y-2">
              {pendingReminders.map(reminder => (
                <div
                  key={reminder.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                  data-testid={`reminder-${reminder.id}`}
                >
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => handleCompleteReminder(reminder.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{reminder.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(reminder.remindAt), 'PPp')}
                    </p>
                  </div>
                </div>
              ))}
              {completedReminders.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    {completedReminders.length} completed
                  </summary>
                  <div className="mt-2 space-y-1">
                    {completedReminders.slice(0, 5).map(reminder => (
                      <div
                        key={reminder.id}
                        className="flex items-center gap-2 p-2 rounded-lg opacity-50"
                      >
                        <Checkbox checked disabled />
                        <span className="text-sm line-through">{reminder.label}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />
            Tasks
            {pendingTasks.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {pendingTasks.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingTasks.length === 0 && completedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet</p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                  data-testid={`task-${task.id}`}
                >
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => handleCompleteTask(task.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{task.title}</p>
                    {task.dueAt && (
                      <p className="text-xs text-muted-foreground">
                        Due: {format(new Date(task.dueAt), 'PP')}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDeleteTask(task.id)}
                  >
                    <span className="text-xs text-muted-foreground">×</span>
                  </Button>
                </div>
              ))}
              {completedTasks.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    {completedTasks.length} completed
                  </summary>
                  <div className="mt-2 space-y-1">
                    {completedTasks.slice(0, 5).map(task => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 p-2 rounded-lg opacity-50"
                      >
                        <Checkbox checked disabled />
                        <span className="text-sm line-through">{task.title}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-Up Generator Drawer */}
      <Drawer open={showFollowUp} onOpenChange={setShowFollowUp}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Generate Follow-Up</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="px-4 max-h-[60vh]">
            <div className="space-y-4 pb-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={followUpMode} onValueChange={(v) => setFollowUpMode(v as FollowUpMode)}>
                  <SelectTrigger data-testid="select-followup-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email_followup">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Follow-Up
                      </div>
                    </SelectItem>
                    <SelectItem value="linkedin_message">
                      <div className="flex items-center gap-2">
                        <SiLinkedin className="w-4 h-4" />
                        LinkedIn Message
                      </div>
                    </SelectItem>
                    <SelectItem value="meeting_intro">
                      <div className="flex items-center gap-2">
                        <CalendarPlus className="w-4 h-4" />
                        Meeting Request
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tone</Label>
                <div className="flex flex-wrap gap-2">
                  {(["friendly", "direct", "warm", "formal"] as FollowUpTone[]).map(tone => (
                    <Button
                      key={tone}
                      variant={followUpTone === tone ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFollowUpTone(tone)}
                    >
                      {FOLLOWUP_TONE_LABELS[tone]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Length</Label>
                <div className="flex gap-2">
                  {(["short", "medium"] as FollowUpLength[]).map(length => (
                    <Button
                      key={length}
                      variant={followUpLength === length ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFollowUpLength(length)}
                    >
                      {FOLLOWUP_LENGTH_LABELS[length]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Goal</Label>
                <Input
                  placeholder="e.g., Book a 15-min call next week"
                  value={followUpGoal}
                  onChange={(e) => setFollowUpGoal(e.target.value)}
                  data-testid="input-followup-goal"
                />
              </div>

              <div className="space-y-2">
                <Label>Context (optional)</Label>
                <Textarea
                  placeholder="e.g., Met at the conference last week, discussed solar projects"
                  value={followUpContext}
                  onChange={(e) => setFollowUpContext(e.target.value)}
                  rows={2}
                  data-testid="input-followup-context"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleGenerateFollowUp}
                disabled={isGenerating}
                data-testid="button-generate"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>

              {generatedFollowUp && (
                <Card className="mt-4">
                  <CardContent className="pt-4 space-y-3">
                    {generatedFollowUp.subject && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Subject</Label>
                        <p className="text-sm font-medium">{generatedFollowUp.subject}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground">Message</Label>
                      <p className="text-sm whitespace-pre-wrap">{generatedFollowUp.body}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyFollowUp}
                        data-testid="button-copy-followup"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                      {contact.email && followUpMode !== 'linkedin_message' && (
                        <Button
                          size="sm"
                          asChild
                          data-testid="button-send-email"
                        >
                          <a 
                            href={`mailto:${contact.email}?subject=${encodeURIComponent(generatedFollowUp.subject || '')}&body=${encodeURIComponent(generatedFollowUp.body)}`}
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            Send via Email
                          </a>
                        </Button>
                      )}
                      {followUpMode === 'linkedin_message' && (
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          data-testid="button-open-linkedin"
                        >
                          <a 
                            href={contact.linkedinUrl || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${contact.name} ${contact.company || ''}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <SiLinkedin className="w-4 h-4 mr-2" />
                            Open LinkedIn
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Add Reminder Drawer */}
      <Drawer open={showAddReminder} onOpenChange={setShowAddReminder}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add Reminder</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-4 pb-4">
            <div className="space-y-2">
              <Label>Remind me to...</Label>
              <Input
                placeholder={`Follow up with ${contact.name}`}
                value={newReminderLabel}
                onChange={(e) => setNewReminderLabel(e.target.value)}
                data-testid="input-reminder-label"
              />
            </div>

            <div className="space-y-2">
              <Label>Quick options</Label>
              <div className="flex flex-wrap gap-2">
                {reminderQuickOptions.map(opt => (
                  <Button
                    key={opt.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddReminder(opt.getDays())}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Or pick a date</Label>
              <Input
                type="datetime-local"
                value={newReminderDate}
                onChange={(e) => setNewReminderDate(e.target.value)}
                data-testid="input-reminder-date"
              />
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={() => handleAddReminder()} disabled={!newReminderDate && !newReminderLabel}>
              <Bell className="w-4 h-4 mr-2" />
              Set Reminder
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Add Task Drawer */}
      <Drawer open={showAddTask} onOpenChange={setShowAddTask}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add Task</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-4 pb-4">
            <div className="space-y-2">
              <Label>Task</Label>
              <Input
                placeholder="Enter task..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                data-testid="input-task-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Due date (optional)</Label>
              <Input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                data-testid="input-task-due"
              />
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Schedule Meeting Drawer */}
      <Drawer open={showScheduleMeeting} onOpenChange={setShowScheduleMeeting}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Schedule Meeting</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-4 pb-4">
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex gap-2">
                <Button
                  variant={meetingDuration === 15 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMeetingDuration(15)}
                >
                  15 min
                </Button>
                <Button
                  variant={meetingDuration === 30 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMeetingDuration(30)}
                >
                  30 min
                </Button>
                <Button
                  variant={meetingDuration === 60 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMeetingDuration(60)}
                >
                  1 hour
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quick slots</Label>
              <div className="flex flex-wrap gap-2">
                {quickTimeSlots.map(slot => (
                  <Button
                    key={slot.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleScheduleMeeting(slot.getTime())}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {slot.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Or pick a time</Label>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={customMeetingTime}
                  onChange={(e) => setCustomMeetingTime(e.target.value)}
                  className="flex-1"
                  data-testid="input-meeting-time"
                />
                <Button onClick={handleCustomMeetingTime} disabled={!customMeetingTime}>
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Creates a calendar file (.ics) you can import into Apple Calendar, Google Calendar, or Outlook.
            </p>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
