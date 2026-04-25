import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ClipboardList,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar as CalendarIcon,
  User,
  Loader2,
  Check,
  ChevronsUpDown,
  Trash2,
  Building2,
  Check as CheckIcon,
  X,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

const priorityColors = {
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
};

const statusColors = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
};

const statusIcons = {
  pending: <Clock className="h-4 w-4" />,
  'in-progress': <Loader2 className="h-4 w-4" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
};

const WorkAllocationPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canCreate = user?.role === 'staff' ? hasPermission('work_orders', 'create') : true;
  const [allocations, setAllocations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [availableWorks, setAvailableWorks] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedLocationType, setSelectedLocationType] = useState<'tower' | 'others' | ''>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllocating, setIsAllocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isWorkPopoverOpen, setIsWorkPopoverOpen] = useState(false);
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');
  const [newAllocation, setNewAllocation] = useState({
    title: '',
    description: '',
    assignedToIds: [] as number[],
    workId: '',
    dueDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  });
  const [userDescriptions, setUserDescriptions] = useState<Record<number, string>>({});

  // Image preview state
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);

  // Reassignment State
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [allocationToReassign, setAllocationToReassign] = useState<any>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [allocationsRes, usersRes, worksRes, propsRes] = await Promise.all([
        api.allocations.getAll(),
        api.users?.getAll().catch(() => ({ success: true, data: [] })) ?? Promise.resolve({ success: true, data: [] }),
        api.works.getAll(),
        api.properties.getByAssociation(Number(user?.associationId)).catch(() => ({ success: true, data: [] }))
      ]);

      if (allocationsRes.success) setAllocations(allocationsRes.data || []);
      if (usersRes.success) setUsers((usersRes.data || []).filter((u: any) => u.isActive !== false).map((u: any) => ({ ...u, name: u.fullName })));
      if (worksRes.success) setAvailableWorks((worksRes.data || []).map((w: any) => ({
        id: w.id,
        workTitle: w.workTitle,
        workCode: w.workCode,
        workType: w.workType || 'Standard'
      })));
      const propItems = (propsRes?.data as any)?.items ?? propsRes?.data ?? [];
      setProperties(Array.isArray(propItems) ? propItems : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const filteredAllocations = allocations.filter((allocation) => {
    if (!allocation) return false;
    const matchesSearch =
      (allocation.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (allocation.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || allocation.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreateAllocation = async () => {
    if (!newAllocation.title || newAllocation.assignedToIds.length === 0 || !newAllocation.dueDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsAllocating(true);
    try {
      const payload = {
        ...newAllocation,
        assignedToIds: newAllocation.assignedToIds,
        userDescriptions: userDescriptions,
        workId: newAllocation.workId ? parseInt(newAllocation.workId) : null,
        propertyId: selectedPropertyId ? parseInt(selectedPropertyId) : null,
        locationType: selectedLocationType || null,
      };

      const response = await api.allocations.create(payload);
      if (response.success) {
        // Upload attachments if any
        if (attachments.length > 0 && response.data) {
          try {
            const ids: number[] = Array.isArray(response.data)
              ? response.data.map((a: any) => a.id).filter(Boolean)
              : response.data.id ? [response.data.id] : [];
            if (ids.length > 0) {
              await Promise.all(ids.map(id => api.allocations.uploadAttachmentsBase64(id, attachments)));
              toast.success('Attachments uploaded');
            }
          } catch (uploadErr) {
            toast.error('Work allocated but attachment upload failed');
          }
          setAttachments([]);
        }
        fetchData();
        setNewAllocation({ title: '', description: '', assignedToIds: [], workId: '', dueDate: '', priority: 'medium' });
        setUserDescriptions({});
        setSelectedLocationType('');
        setSelectedPropertyId('');
        setAttachments([]);
        setIsCreateDialogOpen(false);
        toast.success(response.message || 'Work tasks allocated successfully');
      } else {
        toast.error(response.message || 'Failed to allocate work');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleDeleteAllocation = async (id: number) => {
    try {
      const response = await api.allocations.delete(id);
      if (response.success) {
        setAllocations((prev) => prev.filter((a) => a.id !== id));
        toast.success('Allocation deleted successfully');
      } else {
        toast.error(response.message || 'Failed to delete allocation');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred while deleting');
    }
  };

  const handleReassign = async () => {
    if (!allocationToReassign || !reassignTargetId) return;

    try {
      const response = await api.allocations.reassign(allocationToReassign.id, parseInt(reassignTargetId), reassignReason);
      if (response.success) {
        setAllocations((prev) => prev.map(a => a.id === allocationToReassign.id ? { ...a, assignedTo: parseInt(reassignTargetId), reassignedFrom: a.assignedTo } : a));
        toast.success("Task reassigned successfully");
        setIsReassignDialogOpen(false);
        setAllocationToReassign(null);
        setReassignTargetId('');
        setReassignReason('');
      } else {
        toast.error(response.message || "Failed to reassign");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openReassignDialog = (allocation: any) => {
    setAllocationToReassign(allocation);
    setReassignTargetId('');
    setReassignReason('');
    setIsReassignDialogOpen(true);
  };

  const handleApproveRequest = async (id: number) => {
    try {
      const response = await api.allocations.approveRequest(id);
      if (response.success) {
        setAllocations(prev => prev.map(a => {
          if (a.id === id) {
            return {
              ...a,
              dueDate: a.requestedDueDate || a.dueDate,
              description: a.requestedDescription ? `${a.description}\n\n[Update]: ${a.requestedDescription}` : a.description,
              requestStatus: 'approved',
              requestedDueDate: null,
              requestedDescription: null
            };
          }
          return a;
        }));
        toast.success("Request approved");
      } else {
        toast.error(response.message || "Failed to approve");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDenyRequest = async (id: number) => {
    try {
      const response = await api.allocations.denyRequest(id);
      if (response.success) {
        setAllocations(prev => prev.map(a => a.id === id ? { ...a, requestStatus: 'rejected', requestedDueDate: null, requestedDescription: null } : a));
        toast.success("Request denied");
      } else {
        toast.error(response.message || "Failed to deny");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const pendingCount = allocations.filter((a) => a && a.status === 'pending').length;
  const inProgressCount = allocations.filter((a) => a && a.status === 'in-progress').length;
  const completedCount = allocations.filter((a) => a && a.status === 'completed').length;

  const getUserName = (userId: number) => users.find((u) => u.id === userId)?.name || 'Unknown';

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'completed') return false;
    return new Date(dueDate) < new Date();
  };

  const CreateAllocationDialog = (
    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
      <DialogTrigger asChild>
        {/* Trigger for Desktop Header */}
        <Button className="hidden lg:flex gap-2 shadow-lg shadow-primary/20" onClick={(e) => {
          if (!canCreate) { e.preventDefault(); toast.error("You don't have permission to allocate work"); }
        }}>
          <Plus className="h-4 w-4" />
          Allocate New Work
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col rounded-[2rem] sm:rounded-lg">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Allocate Work</DialogTitle>
          <DialogDescription>
            Create a new work assignment for an employee.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0 no-scrollbar">
          <div className="space-y-2">
            <Label htmlFor="workId">Work Category *</Label>
            <Popover open={isWorkPopoverOpen} onOpenChange={setIsWorkPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isWorkPopoverOpen}
                  className="w-full justify-between rounded-xl"
                >
                  {newAllocation.workId
                    ? availableWorks.find((work) => work.id.toString() === newAllocation.workId)?.workTitle
                    : "Select Work Category"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search work categories..." />
                  <CommandList>
                    <CommandEmpty>No work category found.</CommandEmpty>
                    <CommandGroup>
                      {availableWorks.map((work) => (
                        <CommandItem
                          key={work.id}
                          value={`${work.workTitle} ${work.workCode} ${work.workType || ''}`}
                          onSelect={() => {
                            setNewAllocation((prev) => ({
                              ...prev,
                              workId: work.id.toString(),
                              title: work.workTitle
                            }));
                            setIsWorkPopoverOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  newAllocation.workId === work.id.toString() ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="font-semibold">{work.workTitle}</span>
                            </div>
                            {work.workType && (
                              <span className="text-[9px] text-muted-foreground ml-6 italic">{work.workType}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {newAllocation.workId && (
            <div className="space-y-2">
              <Label>Location Type *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['tower', 'others'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setSelectedLocationType(t); setSelectedPropertyId(''); }}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border-2 py-2 text-sm font-semibold transition-all',
                      selectedLocationType === t
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    )}
                  >
                    {t === 'tower' ? '🏢 Tower' : '🏊 Common Area'}
                  </button>
                ))}
              </div>
              {selectedLocationType && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {selectedLocationType === 'tower' ? 'Select Tower' : 'Select Area'}
                  </Label>
                  <div className="border rounded-xl max-h-36 overflow-y-auto divide-y">
                    {properties
                      .filter(p => selectedLocationType === 'tower'
                        ? p.propertyType !== 'others'
                        : p.propertyType === 'others')
                      .map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPropertyId(p.id.toString())}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm transition-colors hover:bg-accent',
                            selectedPropertyId === p.id.toString()
                              ? 'bg-primary text-primary-foreground hover:bg-primary'
                              : ''
                          )}
                        >
                          {p.propertyName}
                          {p.floorNo && <span className="text-xs opacity-70 ml-2">{p.floorNo} Floors</span>}
                        </button>
                      ))}
                    {properties.filter(p => selectedLocationType === 'tower'
                      ? p.propertyType !== 'others'
                      : p.propertyType === 'others').length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No {selectedLocationType === 'tower' ? 'towers' : 'areas'} found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="description">Specific Instructions</Label>
            <Textarea
              id="description"
              placeholder="Enter any specific details or instructions..."
              value={newAllocation.description}
              onChange={(e) => setNewAllocation((prev) => ({ ...prev, description: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignee">Assign To *</Label>
              <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isUserPopoverOpen}
                    className="w-full justify-between h-auto min-h-10 py-2 rounded-xl"
                  >
                    <div className="flex flex-wrap gap-1">
                      {newAllocation.assignedToIds.length > 0
                        ? newAllocation.assignedToIds.map(id => (
                          <Badge key={id} variant="secondary" className="mr-1 h-5 flex items-center gap-1 bg-primary/10 text-primary border-primary/20">
                            {users.find(u => u.id === id)?.name}
                            <X className="h-3 w-3 cursor-pointer" onClick={(e) => {
                              e.stopPropagation();
                              setNewAllocation(prev => ({
                                ...prev,
                                assignedToIds: prev.assignedToIds.filter(uid => uid !== id)
                              }));
                            }} />
                          </Badge>
                        ))
                        : "Select Employees"}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search employees..." />
                    <CommandList className="max-h-48 overflow-y-auto">
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.name}
                            onSelect={() => {
                              setNewAllocation((prev) => {
                                const isSelected = prev.assignedToIds.includes(user.id);
                                return {
                                  ...prev,
                                  assignedToIds: isSelected
                                    ? prev.assignedToIds.filter(id => id !== user.id)
                                    : [...prev.assignedToIds, user.id]
                                };
                              });
                            }}
                          >
                            <div className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              newAllocation.assignedToIds.includes(user.id) ? "bg-primary text-primary-foreground" : "opacity-50"
                            )}>
                              {newAllocation.assignedToIds.includes(user.id) && <CheckIcon className="h-3 w-3" />}
                            </div>
                            {user.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={newAllocation.dueDate}
                onChange={(e) => setNewAllocation((prev) => ({ ...prev, dueDate: e.target.value }))}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="rounded-xl"
              />
            </div>
          </div>
          {newAllocation.assignedToIds.length > 0 && (
            <div className="space-y-3 p-3 bg-muted/30 rounded-xl border border-dashed animate-in slide-in-from-top-2 duration-300">
              <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <User className="h-3 w-3" />
                Individual Instructions (Optional)
              </Label>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                {newAllocation.assignedToIds.map(userId => (
                  <div key={userId} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{users.find(u => u.id === userId)?.name}</span>
                    </div>
                    <Textarea
                      placeholder={`Instructions for ${users.find(u => u.id === userId)?.name}...`}
                      className="text-xs min-h-[60px] resize-none rounded-lg"
                      value={userDescriptions[userId] || ''}
                      onChange={(e) => setUserDescriptions(prev => ({ ...prev, [userId]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={newAllocation.priority}
              onValueChange={(value: 'low' | 'medium' | 'high') =>
                setNewAllocation((prev) => ({ ...prev, priority: value }))
              }
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Attachment <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <div
              className="border-2 border-dashed rounded-xl p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById('alloc-file-input')?.click()}
            >
              <input
                id="alloc-file-input"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  setAttachments(prev => [...prev, ...files]);
                  e.target.value = '';
                }}
              />
              {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Click to upload images or documents</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {attachments.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 bg-slate-100 rounded px-2 py-0.5 text-xs">
                      <span className="truncate max-w-[100px]">{f.name}</span>
                      <button type="button" onClick={e => { e.stopPropagation(); setAttachments(prev => prev.filter((_, idx) => idx !== i)); }} className="text-muted-foreground hover:text-destructive">×</button>
                    </div>
                  ))}
                  <span className="text-xs text-primary font-bold">+ Add more</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-shrink-0 pt-2 border-t mt-4">
          <Button variant="outline" className="rounded-xl" onClick={() => setIsCreateDialogOpen(false)} disabled={isAllocating}>
            Cancel
          </Button>
          <Button className="rounded-xl" onClick={handleCreateAllocation} disabled={isAllocating}>
            {isAllocating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Allocating...</> : 'Allocate Work'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <DashboardLayout>
      <div className="w-full">
        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden lg:block space-y-8 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Work Allocation</h1>
              <p className="text-muted-foreground">Assign and monitor work for your team</p>
            </div>
            {CreateAllocationDialog}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover-lift border-none shadow-md cursor-pointer" onClick={() => setFilterStatus('all')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
                <ClipboardList className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allocations.filter(a => a).length}</div>
              </CardContent>
            </Card>
            <Card className="hover-lift border-none shadow-md cursor-pointer" onClick={() => setFilterStatus('pending')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-500">{pendingCount}</div>
              </CardContent>
            </Card>
            <Card className="hover-lift border-none shadow-md cursor-pointer" onClick={() => setFilterStatus('in-progress')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Loader2 className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">{inProgressCount}</div>
              </CardContent>
            </Card>
            <Card className="hover-lift border-none shadow-md cursor-pointer" onClick={() => setFilterStatus('completed')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">{completedCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-xl border-t-4 border-t-primary overflow-hidden">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Allocation Records</CardTitle>
                <div className="flex gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search allocations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-muted/50 focus:bg-background h-9"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="border-x">
                    <TableHeader className="bg-primary hover:bg-primary">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-white font-semibold last:border-r-0 h-11 w-[250px]">Work Identity</TableHead>
                        <TableHead className="text-white font-semibold last:border-r-0 h-11">Instructions</TableHead>
                        <TableHead className="text-white font-semibold last:border-r-0 h-11">Assigned To</TableHead>
                        <TableHead className="text-white font-semibold last:border-r-0 h-11">Status & Due</TableHead>
                        <TableHead className="text-white font-semibold last:border-r-0 h-11 text-center">Priority</TableHead>
                        <TableHead className="text-right text-white font-semibold px-4 h-11">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAllocations.map((allocation) => (
                        <TableRow key={allocation.id} className={cn("transition-colors group hover:bg-slate-50/50", allocation.requestStatus === 'pending' && "bg-amber-50/50")}>
                          <TableCell className="align-top border-r border-slate-200 last:border-r-0">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-sm leading-tight text-primary">{allocation.title}</span>
                              <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                                <span className="font-semibold px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 border">{allocation.workTitle}</span>
                              </div>
                              {allocation.attachmentUrls && (() => {
                                let files: { Name: string; Type: string; Data: string }[] = [];
                                try {
                                  const parsed = JSON.parse(allocation.attachmentUrls);
                                  if (Array.isArray(parsed)) files = parsed;
                                } catch { /* not JSON */ }
                                if (files.length === 0) return null;
                                return (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {files.map((f, i) => {
                                      const isImage = f.Type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.Name);
                                      return isImage ? (
                                        <button key={i} type="button" onClick={() => setPreviewImage({ src: f.Data, name: f.Name })} title={f.Name}>
                                          <img src={f.Data} alt={f.Name} className="h-8 w-8 rounded object-cover border hover:opacity-80 cursor-zoom-in" />
                                        </button>
                                      ) : (
                                        <a key={i} href={f.Data} download={f.Name}
                                          className="text-[10px] bg-slate-100 hover:bg-slate-200 rounded px-1.5 py-0.5 text-slate-600 flex items-center gap-0.5">
                                          📎 <span className="truncate max-w-[80px]">{f.Name}</span>
                                        </a>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="align-top border-r border-slate-200 last:border-r-0">
                            {allocation.description ? (
                              <div className="text-xs text-muted-foreground italic line-clamp-3">
                                {allocation.description}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/50 italic">No instruction given</span>
                            )}
                            {allocation.progressNote && (
                              <div className="mt-1.5 flex items-start gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wide shrink-0 mt-0.5">Live</span>
                                <span className="text-[11px] text-blue-800 italic leading-tight">{allocation.progressNote}</span>
                              </div>
                            )}
                            {allocation.requestStatus === 'pending' && (
                              <div className="mt-2 p-2 bg-amber-50/50 rounded border border-amber-200/50 text-[10px]">
                                <p className="font-bold text-amber-800 mb-1">Update Request:</p>
                                <div className="flex gap-2 mt-2">
                                  <Button size="sm" className="h-5 text-[9px] px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApproveRequest(allocation.id)}>Approve</Button>
                                  <Button size="sm" variant="destructive" className="h-5 text-[9px] px-2" onClick={() => handleDenyRequest(allocation.id)}>Deny</Button>
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="align-top border-r border-slate-200 last:border-r-0">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                {getUserName(allocation.assignedTo).charAt(0)}
                              </div>
                              <span className="font-medium text-sm">{getUserName(allocation.assignedTo)}</span>
                            </div>
                            <Button
                              variant="link"
                              className="h-auto p-0 text-[10px] text-muted-foreground hover:text-primary mt-1"
                              onClick={() => openReassignDialog(allocation)}
                            >
                              Reassign
                            </Button>
                          </TableCell>
                          <TableCell className="align-top border-r border-slate-200 last:border-r-0">
                            <div className="flex flex-col gap-1.5">
                              <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold w-fit border", statusColors[allocation.status])}>
                                {statusIcons[allocation.status]}
                                <span className="capitalize">{allocation.status.replace('-', ' ')}</span>
                              </div>
                              <span className={cn("text-xs font-semibold", isOverdue(allocation.dueDate, allocation.status) ? 'text-destructive' : 'text-slate-600')}>
                                Due: {format(new Date(allocation.dueDate), 'MMM dd')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center align-top border-r border-slate-200 last:border-r-0">
                            <Badge variant="outline" className={cn("px-2 py-0 h-5 font-bold uppercase text-[10px]", priorityColors[allocation.priority])}>
                              {allocation.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right align-top px-4">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Allocation?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove this assigned work for {getUserName(allocation.assignedTo)}. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteAllocation(allocation.id)} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div> {/* END DESKTOP VIEW */}

        {/* ===== MOBILE VIEW ===== */}
        <div className="block lg:hidden min-h-screen bg-slate-50 dark:bg-slate-950 pb-[80px] -mx-4 -mt-4">
          {/* Mobile Header */}
          <div className="bg-primary/95 pt-8 pb-10 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h1 className="text-2xl font-black tracking-tight">Work Allocation</h1>
                <p className="text-[10px] text-white/70 font-bold tracking-widest uppercase mt-1 italic">Assign & Monitor Tasks</p>
              </div>
              <div onClick={(e) => {
                if (!canCreate) { e.preventDefault(); toast.error("You don't have permission to allocate work"); }
                else { setIsCreateDialogOpen(true); }
              }} className="bg-white/10 hover:bg-white/20 text-white rounded-full h-[46px] w-[46px] shadow-sm backdrop-blur-md p-0 flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer">
                <Plus className="h-6 w-6" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          {/* Stats Summary - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3 px-5 -mt-8 relative z-20 pb-2">
            {[
              { label: 'Total', count: allocations.length, color: 'text-primary', dot: 'bg-primary/40', status: 'all' },
              { label: 'Pending', count: pendingCount, color: 'text-amber-500', dot: 'bg-amber-400', status: 'pending' },
              { label: 'Active', count: inProgressCount, color: 'text-blue-500', dot: 'bg-blue-400', status: 'in-progress' },
              { label: 'Done', count: completedCount, color: 'text-emerald-500', dot: 'bg-emerald-400', status: 'completed' },
            ].map((stat) => (
              <div
                key={stat.label}
                onClick={() => setFilterStatus(stat.status as any)}
                className={cn(
                  "bg-white dark:bg-card rounded-3xl p-4 shadow-lg ring-1 cursor-pointer active:scale-[0.97] transition-all",
                  filterStatus === stat.status ? "ring-2 ring-primary" : "ring-black/5"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("text-[9px] font-black uppercase tracking-widest", stat.color)}>{stat.label}</span>
                  <span className={cn("h-2 w-2 rounded-full", stat.dot)} />
                </div>
                <p className="text-4xl font-black tracking-tighter text-slate-800 dark:text-slate-100 leading-none">
                  {isLoading ? '—' : stat.count}
                </p>
              </div>
            ))}
          </div>

          {/* Mobile Search & List */}
          <div className="px-5 space-y-6 mt-6">
            <div className="relative shadow-sm shadow-black/5 rounded-[1.5rem]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder="Search allocations..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="pl-12 h-14 rounded-[1.5rem] bg-white dark:bg-slate-900 border-none ring-1 ring-slate-100 dark:ring-slate-800 text-sm font-bold shadow-none focus-visible:ring-primary" 
              />
            </div>

            {/* Mobile Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {['all', 'pending', 'in-progress', 'completed'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilterStatus(tab as any)}
                  className={cn(
                    "shrink-0 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all active:scale-95",
                    filterStatus === tab
                      ? "bg-slate-800 text-white shadow-md"
                      : "bg-white dark:bg-slate-800 text-slate-500 ring-1 ring-slate-100 dark:ring-slate-700"
                  )}
                >
                  {tab === 'all' ? 'All' : tab.replace('-', ' ')}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              </div>
            ) : filteredAllocations.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-white dark:bg-card rounded-[2.5rem] shadow-sm ring-1 ring-slate-100">
                <div className="h-20 w-20 mb-4 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <ClipboardList className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-base font-black text-slate-500 tracking-tight">No allocations found</p>
              </div>
            ) : (
              <div className="space-y-4 pb-12">
                {filteredAllocations.map((allocation) => (
                  <div 
                    key={allocation.id} 
                    className={cn(
                      "bg-white dark:bg-card rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5 flex flex-col gap-4 relative overflow-hidden transition-all active:scale-[0.99]",
                      allocation.requestStatus === 'pending' && "ring-2 ring-amber-400/50 bg-amber-50/10"
                    )}
                  >
                    {allocation.requestStatus === 'pending' && (
                      <div className="absolute top-0 right-0 bg-amber-400 text-[8px] font-black uppercase px-3 py-1 rounded-bl-xl text-white tracking-widest">
                        Update Request
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="outline" className={cn("text-[8px] px-2 py-0.5 font-black uppercase tracking-widest border-0", priorityColors[allocation.priority])}>
                            {allocation.priority}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">#{allocation.id}</span>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight tracking-tight">
                          {allocation.title}
                        </h3>
                        {allocation.workTitle && (
                          <p className="text-[10px] font-bold text-primary mt-1 flex items-center gap-1 opacity-80">
                            <Building2 className="h-3 w-3" /> {allocation.workTitle}
                          </p>
                        )}
                      </div>
                      
                      <div className={cn(
                        "h-12 w-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border shadow-sm",
                        isOverdue(allocation.dueDate, allocation.status) ? "bg-rose-50 border-rose-100 text-rose-500" : "bg-slate-50 border-slate-100 text-slate-600"
                      )}>
                        <span className="text-[8px] font-black uppercase opacity-60 leading-none mb-0.5">Due</span>
                        <span className="text-xs font-black leading-none">{format(new Date(allocation.dueDate), 'dd')}</span>
                        <span className="text-[8px] font-black uppercase leading-none mt-0.5">{format(new Date(allocation.dueDate), 'MMM')}</span>
                      </div>
                    </div>

                    {allocation.description && (
                      <div className="bg-slate-50/80 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed italic">
                          "{allocation.description}"
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 ring-1 ring-slate-100 dark:ring-slate-700 pr-3 pl-1 py-1 rounded-full shadow-sm">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black border border-primary/20">
                          {getUserName(allocation.assignedTo).charAt(0)}
                        </div>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{getUserName(allocation.assignedTo)}</span>
                      </div>

                      <div className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm",
                        statusColors[allocation.status]
                      )}>
                        {statusIcons[allocation.status]}
                        {allocation.status.replace('-', ' ')}
                      </div>
                    </div>

                    {/* Progress Note & Attachments logic same as before... */}
                    {allocation.progressNote && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 line-clamp-1">{allocation.progressNote}</p>
                      </div>
                    )}

                    {allocation.attachmentUrls && (() => {
                      let files: { Name: string; Type: string; Data: string }[] = [];
                      try {
                        const parsed = JSON.parse(allocation.attachmentUrls);
                        if (Array.isArray(parsed)) files = parsed;
                      } catch { /* not JSON */ }
                      if (files.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {files.map((f, i) => {
                            const isImage = f.Type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.Name);
                            return isImage ? (
                              <button key={i} type="button" onClick={() => setPreviewImage({ src: f.Data, name: f.Name })} className="relative h-12 w-12 rounded-xl overflow-hidden border ring-1 ring-black/5 active:scale-95 transition-transform">
                                <img src={f.Data} alt={f.Name} className="h-full w-full object-cover" />
                              </button>
                            ) : (
                              <a key={i} href={f.Data} download={f.Name} className="h-12 flex items-center gap-2 px-3 rounded-xl bg-slate-50 border border-slate-100 active:scale-95 transition-transform">
                                <ClipboardList className="h-4 w-4 text-slate-400" />
                                <span className="text-[9px] font-bold text-slate-600 max-w-[60px] truncate">{f.Name}</span>
                              </a>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Request Actions */}
                    {allocation.requestStatus === 'pending' && (
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button 
                          onClick={() => handleApproveRequest(allocation.id)}
                          className="h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-emerald-500/20"
                        >
                          Approve Update
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleDenyRequest(allocation.id)}
                          className="h-10 rounded-xl border-rose-100 text-rose-500 hover:bg-rose-50 text-[10px] font-black uppercase tracking-widest"
                        >
                          Decline
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <Button 
                        variant="outline" 
                        className="flex-1 h-11 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-800 text-white border-0 hover:bg-slate-900 shadow-lg shadow-slate-800/20 active:scale-95 transition-all"
                        onClick={() => openReassignDialog(allocation)}
                      >
                        <User className="h-3.5 w-3.5 mr-2" /> Reassign
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="h-11 w-11 rounded-2xl border-rose-100 text-rose-500 hover:bg-rose-50 active:scale-95 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[2rem] max-w-[90vw] sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-black text-xl tracking-tight">Delete Allocation?</AlertDialogTitle>
                            <AlertDialogDescription className="font-semibold text-slate-500">
                              This will permanently remove this task for {getUserName(allocation.assignedTo)}. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-row gap-2 mt-4">
                            <AlertDialogCancel className="flex-1 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteAllocation(allocation.id)}
                              className="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-500/20"
                            >
                              Confirm
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shared Modals */}
      
      {/* Shared Reassign Dialog */}
      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[2rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">Reassign Task</DialogTitle>
            <DialogDescription className="font-semibold text-muted-foreground">
              Move this work to another employee
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Select New Employee</Label>
              <div className="border rounded-2xl max-h-56 overflow-y-auto divide-y scrollbar-none">
                {users.filter(u => u.id !== allocationToReassign?.assignedTo).map((u: any) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setReassignTargetId(u.id.toString())}
                    className={cn(
                      "w-full text-left px-4 py-3 text-sm font-bold transition-all flex items-center justify-between",
                      reassignTargetId === u.id.toString() 
                        ? "bg-primary text-white" 
                        : "hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <span>{u.name}</span>
                    {reassignTargetId === u.id.toString() && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Reason for Reassignment</Label>
              <Textarea 
                placeholder="Optional: Enter reason..." 
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                className="rounded-xl border-slate-200 focus:ring-primary min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1 rounded-2xl font-black text-xs uppercase tracking-widest" onClick={() => setIsReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReassign} 
              disabled={!reassignTargetId}
              className="flex-1 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              Reassign Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shared Preview Image Modal */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
            <div className="relative w-full h-full flex flex-col items-center">
              <img src={previewImage.src} alt={previewImage.name} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
              <p className="mt-4 text-white font-black text-sm uppercase tracking-widest drop-shadow-md">{previewImage.name}</p>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setPreviewImage(null)}
                className="absolute -top-4 -right-4 h-10 w-10 rounded-full bg-white text-slate-900 border-none shadow-xl active:scale-95 transition-transform"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Include the shared CreateAllocationDialog at the root level if not triggered by the header buttons */}
      {/* But since we use it in both headers, it will be rendered twice as a component. 
          Actually, the Dialog itself is the wrapper. I'll just make sure the state is consistent.
      */}
      {CreateAllocationDialog}

    </DashboardLayout>
  );
};

export default WorkAllocationPage;
