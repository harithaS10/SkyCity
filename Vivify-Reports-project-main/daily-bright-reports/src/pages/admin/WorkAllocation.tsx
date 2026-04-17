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
      // Reassign only once with all data
      const response = await api.allocations.reassign(allocationToReassign.id, parseInt(reassignTargetId), reassignReason);

      setAllocations((prev) => prev.map(a => a.id === allocationToReassign.id ? { ...a, assignedTo: parseInt(reassignTargetId), reassignedFrom: a.assignedTo } : a));
      toast.success("Task reassigned successfully");
      setIsReassignDialogOpen(false);
      setAllocationToReassign(null);
      setReassignTargetId('');
      setReassignReason('');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openReassignDialog = (allocation: any) => {
    setAllocationToReassign(allocation);
    setReassignTargetId(''); // Reset
    setReassignReason(''); // Reset
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

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Work Allocation</h1>
            <p className="text-muted-foreground">Assign and monitor work for your team</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg shadow-primary/20" onClick={(e) => {
                if (!canCreate) { e.preventDefault(); toast.error("You don't have permission to allocate work"); }
              }}>
                <Plus className="h-4 w-4" />
                Allocate New Work
              </Button>
            </DialogTrigger>            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Allocate Work</DialogTitle>
                <DialogDescription>
                  Create a new work assignment for an employee.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
                <div className="space-y-2">
                  <Label htmlFor="workId">Work Category *</Label>
                  <Popover open={isWorkPopoverOpen} onOpenChange={setIsWorkPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isWorkPopoverOpen}
                        className="w-full justify-between"
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
                {/* Location selection — shown after work category is picked */}
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
                            'flex items-center justify-center gap-2 rounded-lg border-2 py-2 text-sm font-semibold transition-all',
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
                        <div className="border rounded-md max-h-36 overflow-y-auto divide-y">
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
                          className="w-full justify-between h-auto min-h-10 py-2"
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
                    />
                  </div>
                </div>

                {newAllocation.assignedToIds.length > 0 && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-dashed animate-in slide-in-from-top-2 duration-300">
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
                            placeholder={`Specific instructions for ${users.find(u => u.id === userId)?.name}...`}
                            className="text-xs min-h-[60px] resize-none"
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
                    <SelectTrigger>
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
                    className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
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
                        <span className="text-xs text-primary">+ Add more</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-shrink-0 pt-2 border-t">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isAllocating}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAllocation} disabled={isAllocating}>
                  {isAllocating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Allocating...</> : 'Allocate Work'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

        <Card className="border-none shadow-xl border-t-4 border-t-primary">
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
              <>
                {/* Mobile card view */}
                <div className="lg:hidden divide-y">
                  {filteredAllocations.map((allocation) => (
                    <div key={allocation.id} className={cn("p-4 space-y-3", allocation.requestStatus === 'pending' && "bg-amber-50/50")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-primary leading-tight truncate">{allocation.title}</p>
                          {allocation.workTitle && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 border inline-block mt-1">{allocation.workTitle}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className={cn("px-2 py-0 h-5 font-bold uppercase text-[10px]", priorityColors[allocation.priority])}>
                            {allocation.priority}
                          </Badge>
                        </div>
                      </div>

                      {allocation.attachmentUrls && (() => {
                        let files: { Name: string; Type: string; Data: string }[] = [];
                        try {
                          const parsed = JSON.parse(allocation.attachmentUrls);
                          if (Array.isArray(parsed)) files = parsed;
                        } catch { /* not JSON */ }
                        if (files.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1">
                            {files.map((f, i) => {
                              const isImage = f.Type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.Name);
                              return isImage ? (
                                <button key={i} type="button" onClick={() => setPreviewImage({ src: f.Data, name: f.Name })} title={f.Name}>
                                  <img src={f.Data} alt={f.Name} className="h-10 w-10 rounded object-cover border hover:opacity-80 cursor-zoom-in" />
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

                      {allocation.progressNote && (
                        <div className="flex items-start gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                          <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wide shrink-0 mt-0.5">Live</span>
                          <span className="text-[11px] text-blue-800 italic leading-tight">{allocation.progressNote}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                          {getUserName(allocation.assignedTo).charAt(0)}
                        </div>
                        <span className="text-sm font-medium">{getUserName(allocation.assignedTo)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border", statusColors[allocation.status])}>
                          {statusIcons[allocation.status]}
                          <span className="capitalize">{allocation.status.replace('-', ' ')}</span>
                        </div>
                        <span className={cn("text-xs font-semibold", isOverdue(allocation.dueDate, allocation.status) ? 'text-destructive' : 'text-slate-600')}>
                          Due: {format(new Date(allocation.dueDate), 'MMM dd, yyyy')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Button
                          variant="link"
                          className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => openReassignDialog(allocation)}
                        >
                          Reassign
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
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
                              <AlertDialogAction
                                onClick={() => handleDeleteAllocation(allocation.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden lg:block overflow-x-auto">
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
                              } catch { /* not JSON, skip */ }
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
                            {allocation.requestStatus === 'pending' && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[9px] h-4 px-1 w-fit mt-1">Request Pending</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top border-r border-slate-200 last:border-r-0">
                          {allocation.description ? (
                            <div className="text-xs text-muted-foreground italic">
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
                              <p className="font-bold text-amber-800 mb-1">Request:</p>
                              {allocation.requestedDueDate && <p>New Date: {format(new Date(allocation.requestedDueDate), 'MMM dd')}</p>}
                              {allocation.requestedDescription && <p>Note: {allocation.requestedDescription}</p>}
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
                            <span className="font-medium">{getUserName(allocation.assignedTo)}</span>
                          </div>
                          {allocation.assignedTo === allocation.assignedBy && (
                            <Badge variant="outline" className="mt-1 text-[8px] h-3.5 px-1 bg-slate-50 text-slate-500 border-slate-200 uppercase tracking-tighter font-bold">Self-Initiated</Badge>
                          )}
                          <Button
                            variant="link"
                            className="h-auto p-0 text-[10px] text-muted-foreground hover:text-primary"
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
                            <div className="flex flex-col">
                              <span className={cn(
                                "text-xs font-semibold",
                                isOverdue(allocation.dueDate, allocation.status) ? 'text-destructive' : 'text-slate-600'
                              )}>
                                Due: {format(new Date(allocation.dueDate), 'MMM dd')}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center align-top border-r border-slate-200 last:border-r-0">
                          <Badge variant="outline" className={cn("px-2 py-0 h-5 font-bold uppercase text-[10px] mx-auto", priorityColors[allocation.priority])}>
                            {allocation.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <div className="flex items-center justify-end gap-1">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
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
                                  <AlertDialogAction
                                    onClick={() => handleDeleteAllocation(allocation.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Task: {allocationToReassign?.title}</DialogTitle>
            <DialogDescription>
              Transfer this task to another team member. Using the reason field will update the reassignment history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Assign To *</Label>
              <Select value={reassignTargetId} onValueChange={setReassignTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(u => allocationToReassign && u.id !== allocationToReassign.assignedTo)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason for Reassignment *</Label>
              <Textarea
                placeholder="Why is this being reassigned?"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReassignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleReassign} disabled={!reassignTargetId || !reassignReason}>Confirm Reassignment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Image lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-slate-100 z-10"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.name}
              className="max-w-[90vw] max-h-[85vh] rounded-lg object-contain shadow-2xl"
            />
            <p className="text-center text-white/70 text-xs mt-2 truncate">{previewImage.name}</p>
          </div>
        </div>
      )}

    </DashboardLayout >
  );
};

export default WorkAllocationPage;
