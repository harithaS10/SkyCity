import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  MessageSquareWarning, Search, Clock, CheckCircle2, AlertCircle,
  User, Building2, Calendar, Loader2, Plus, Hash,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Complaint, ComplaintCategory, Unit } from '@/types';

const priorityColors: Record<string, string> = {
  Low: 'bg-muted text-muted-foreground border-muted',
  Medium: 'bg-warning/10 text-warning border-warning/20',
  High: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  Urgent: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusColors: Record<string, string> = {
  Open: 'bg-destructive/10 text-destructive border-destructive/20',
  Assigned: 'bg-warning/10 text-warning border-warning/20',
  'In Progress': 'bg-primary/10 text-primary border-primary/20',
  Resolved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Closed: 'bg-muted text-muted-foreground border-muted',
};

const Complaints: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canManage = ['admin', 'sub_admin', 'property_manager', 'helpdesk', 'super_admin'].includes(user?.role ?? '');
  const canCreate = user?.role === 'staff' ? hasPermission('complaints', 'create') : true;

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', priority: 'Medium',
    categoryId: '', unitId: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({ staffId: '', managerId: '' });

  const load = async () => {
    setIsLoading(true);
    try {
      // Always fetch all — filter client-side for accurate counts
      const res = await api.complaints.getAll({});
      const items = (res.data as any)?.items ?? res.data ?? [];
      setComplaints(Array.isArray(items) ? items : []);
    } catch { toast.error('Failed to load complaints'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    api.works.getAll().then(res => {
      if (res.success && res.data) setCategories(res.data as any);
    }).catch(() => {});
  }, []);

  const filtered = complaints.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || c.title.toLowerCase().includes(q) || c.complaintNumber.toLowerCase().includes(q);
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    Open: complaints.filter(c => c.status === 'Open').length,
    ...(canManage ? { Assigned: complaints.filter(c => c.status === 'Assigned').length } : {}),
    'In Progress': complaints.filter(c => c.status === 'In Progress').length,
    Resolved: complaints.filter(c => c.status === 'Resolved').length,
  };

  const handleCreate = async () => {
    if (!form.title || !form.categoryId) {
      toast.error('Title and category are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.complaints.create({
        residentId: user!.id,
        unitId: parseInt(form.unitId) || user?.unitId || 0,
        categoryId: 0,
        title: form.title,
        description: form.description,
        priority: form.priority as any,
      });
      if (res.success !== false) {
        toast.success('Complaint created');
        setIsCreateOpen(false);
        setForm({ title: '', description: '', priority: 'Medium', categoryId: '', unitId: '' });
        load();
      } else {
        toast.error(res.message || 'Failed to create');
      }
    } catch { toast.error('Failed to create complaint'); }
    finally { setIsSubmitting(false); }
  };

  const handleStatusUpdate = async (complaintId: number, newStatus: string) => {
    try {
      const res = await (api.complaints as any).updateStatus(complaintId, newStatus);
      if (res.success !== false) {
        toast.success(`Status updated to ${newStatus}`);
        load();
      } else {
        toast.error(res.message || 'Failed to update status');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update status');
    }
  };
  const handleAssign = async () => {
    if (!selected || !assignForm.staffId) {
      toast.error('Please select a staff member');
      return;
    }
    try {
      const res = await api.complaints.assign(selected.id, {
        staffId: parseInt(assignForm.staffId),
        managerId: user?.id ?? 0,
      });
      if (res.success !== false) {
        toast.success('Complaint assigned');
        setIsAssignOpen(false);
        setAssignForm({ staffId: '', managerId: '' });
        load();
      } else {
        toast.error(res.message || 'Failed to assign');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to assign complaint');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-primary" />
              Complaint Management
            </h1>
            <p className="text-muted-foreground text-xs">Manage and track complaints</p>
          </div>
          <Button size="sm" onClick={() => {
            if (!canCreate) { toast.error("You don't have permission to create complaints"); return; }
            setIsCreateOpen(true);
          }} className="gap-1 shrink-0">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(counts).map(([label, count]) => (
            <Card key={label} className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFilterStatus(label)}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                  {label === 'Open' && <AlertCircle className="h-4 w-4 text-destructive" />}
                  {label === 'Assigned' && <Clock className="h-4 w-4 text-warning" />}
                  {label === 'In Progress' && <Loader2 className="h-4 w-4 text-primary" />}
                  {label === 'Resolved' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                <div>
                  <p className="text-xl font-bold">{isLoading ? '—' : count}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search complaints..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Tabs value={filterStatus} onValueChange={setFilterStatus}>
            <TabsList className={`w-full grid ${canManage ? 'grid-cols-5' : 'grid-cols-4'} h-9 rounded-xl bg-muted/60 p-1`}>
              <TabsTrigger value="all" className="rounded-lg text-xs font-semibold">All</TabsTrigger>
              <TabsTrigger value="Open" className="rounded-lg text-xs font-semibold data-[state=active]:bg-rose-500 data-[state=active]:text-white">
                Open {counts.Open > 0 && <span className="ml-1 text-[9px]">({counts.Open})</span>}
              </TabsTrigger>
              {canManage && <TabsTrigger value="Assigned" className="rounded-lg text-xs font-semibold data-[state=active]:bg-amber-500 data-[state=active]:text-white">Assigned</TabsTrigger>}
              <TabsTrigger value="In Progress" className="rounded-lg text-xs font-semibold data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <span className="hidden sm:inline">In Progress</span>
                <span className="sm:hidden">Active</span>
              </TabsTrigger>
              <TabsTrigger value="Resolved" className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Done</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            No complaints found.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map(c => (
              <Card key={c.id} className={cn(
                "hover:shadow-md transition-shadow border-l-4",
                c.priority === 'Urgent' ? 'border-l-rose-500' :
                c.priority === 'High' ? 'border-l-orange-500' :
                c.priority === 'Medium' ? 'border-l-amber-400' : 'border-l-slate-300'
              )}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.title}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Hash className="h-2.5 w-2.5" />{c.complaintNumber}
                        <span className="mx-1">·</span>
                        <Calendar className="h-2.5 w-2.5" />{format(new Date(c.createdAt), 'MMM dd')}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      <Badge className={cn("text-[10px] px-1.5 py-0 h-4", priorityColors[c.priority])} variant="outline">{c.priority}</Badge>
                      <Badge className={cn("text-[10px] px-1.5 py-0 h-4", statusColors[c.status])} variant="outline">{c.status}</Badge>
                    </div>
                  </div>
                  {c.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{c.description}</p>
                  )}
                  {canManage && c.status === 'Open' && (
                    <Button size="sm" className="w-full h-7 text-xs gap-1.5" onClick={() => {
                      setSelected(c); setIsAssignOpen(true);
                      setIsLoadingStaff(true);
                      api.users.getAll().then(res => {
                        if (res.success && res.data) {
                          const excluded = ['admin', 'super_admin'];
                          setStaffList(res.data.filter((u: any) => !excluded.includes(u.role)));
                        }
                      }).catch(() => {}).finally(() => setIsLoadingStaff(false));
                    }}>
                      <User className="h-3 w-3" /> Assign
                    </Button>
                  )}
                  {canManage && c.status !== 'Open' && c.status !== 'Closed' && c.status !== 'Resolved' && (
                    <div className="flex gap-1.5">
                      {c.status !== 'In Progress' && (
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                          onClick={() => handleStatusUpdate(c.id, 'In Progress')}>
                          <Loader2 className="h-3 w-3" /> Active
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => handleStatusUpdate(c.id, 'Resolved')}>
                        <CheckCircle2 className="h-3 w-3" /> Resolve
                      </Button>
                    </div>
                  )}
                  {user?.role === 'staff' && ['Open', 'Assigned', 'In Progress'].includes(c.status) && (
                    <div className="flex gap-2">
                      {c.status === 'Open' && (
                        <Button size="sm" variant="outline" className="flex-1 h-7 gap-1 border-blue-200 text-blue-600 hover:bg-blue-50 text-xs"
                          onClick={() => handleStatusUpdate(c.id, 'In Progress')}>
                          <Loader2 className="h-3 w-3" /> Start
                        </Button>
                      )}
                      {(c.status === 'Assigned' || c.status === 'In Progress') && (
                        <>
                          {c.status === 'Assigned' && (
                            <Button size="sm" variant="outline" className="flex-1 h-7 gap-1 border-blue-200 text-blue-600 hover:bg-blue-50 text-xs"
                              onClick={() => handleStatusUpdate(c.id, 'In Progress')}>
                              <Loader2 className="h-3 w-3" /> Active
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="flex-1 h-7 gap-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50 text-xs"
                            onClick={() => handleStatusUpdate(c.id, 'Resolved')}>
                            <CheckCircle2 className="h-3 w-3" /> Resolve
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Complaint</DialogTitle>
              <DialogDescription>Submit a new complaint</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Brief title of the issue" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea value={form.description} rows={3}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the issue in detail..." />
              </div>
              <div className="space-y-1">
                <Label>Category *</Label>
                <Select value={form.categoryId} onValueChange={v => setForm(p => ({ ...p, categoryId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={categories.length === 0 ? 'No categories available' : 'Select category'} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.workTitle || c.categoryName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Dialog */}
        <Dialog open={isAssignOpen} onOpenChange={v => { setIsAssignOpen(v); if (!v) setAssignForm({ staffId: '', managerId: '' }); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Assign Complaint</DialogTitle>
              <DialogDescription>{selected?.complaintNumber} — {selected?.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label>Assign To *</Label>
              {isLoadingStaff ? (
                <p className="text-sm text-muted-foreground">Loading staff...</p>
              ) : (
                <div className="border rounded-md max-h-56 overflow-y-auto divide-y">
                  {staffList.map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setAssignForm(p => ({ ...p, staffId: s.id.toString() }))}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-accent ${assignForm.staffId === s.id.toString() ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}
                    >
                      {s.fullName || s.username}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
              <Button onClick={handleAssign} disabled={!assignForm.staffId}>Assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Complaints;
