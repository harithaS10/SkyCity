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
import { formatDistanceToNow } from 'date-fns';
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
  const { user } = useAuth();
  const canManage = ['admin', 'sub_admin', 'property_manager', 'helpdesk', 'super_admin'].includes(user?.role ?? '');

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
      const res = await api.complaints.getAll({ status: filterStatus === 'all' ? undefined : filterStatus });
      const items = (res.data as any)?.items ?? res.data ?? [];
      setComplaints(Array.isArray(items) ? items : []);
    } catch { toast.error('Failed to load complaints'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]);

  useEffect(() => {
    api.categories.getAll().then(res => {
      if (res.success && res.data) setCategories(res.data as any);
    }).catch(() => {});
  }, []);

  const filtered = complaints.filter(c => {
    const q = searchQuery.toLowerCase();
    return !q || c.title.toLowerCase().includes(q) || c.complaintNumber.toLowerCase().includes(q);
  });

  const counts = {
    Open: complaints.filter(c => c.status === 'Open').length,
    Assigned: complaints.filter(c => c.status === 'Assigned').length,
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
        categoryId: parseInt(form.categoryId),
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

  const handleAssign = async () => {
    if (!selected || !assignForm.staffId) {
      toast.error('Please select a staff member');
      return;
    }
    try {
      const res = await api.complaints.assign(selected.id, {
        staffId: parseInt(assignForm.staffId),
        managerId: user!.id,
      });
      if (res.success) {
        toast.success('Complaint assigned');
        setIsAssignOpen(false);
        load();
      } else {
        toast.error(res.message || 'Failed to assign');
      }
    } catch { toast.error('Failed to assign complaint'); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquareWarning className="h-7 w-7 text-primary" />
              Complaint Management
            </h1>
            <p className="text-muted-foreground text-sm">Manage and track complaints</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Complaint
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          {Object.entries(counts).map(([label, count]) => (
            <Card key={label} className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFilterStatus(label)}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  {label === 'Open' && <AlertCircle className="h-5 w-5 text-destructive" />}
                  {label === 'Assigned' && <Clock className="h-5 w-5 text-warning" />}
                  {label === 'In Progress' && <Loader2 className="h-5 w-5 text-primary" />}
                  {label === 'Resolved' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '—' : count}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search complaints..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Tabs value={filterStatus} onValueChange={setFilterStatus}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="Open">Open</TabsTrigger>
              <TabsTrigger value="Assigned">Assigned</TabsTrigger>
              <TabsTrigger value="In Progress">In Progress</TabsTrigger>
              <TabsTrigger value="Resolved">Resolved</TabsTrigger>
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
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map(c => (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{c.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Hash className="h-3 w-3" />{c.complaintNumber}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Badge className={priorityColors[c.priority]} variant="outline">{c.priority}</Badge>
                      <Badge className={statusColors[c.status]} variant="outline">{c.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {c.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                  </div>
                  {canManage && c.status === 'Open' && (
                    <Button size="sm" className="w-full gap-2" onClick={() => {
                      setSelected(c); setIsAssignOpen(true);
                    }}>
                      <User className="h-4 w-4" /> Assign
                    </Button>
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
                      <SelectItem key={c.id} value={c.id.toString()}>{c.categoryName}</SelectItem>
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
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Complaint</DialogTitle>
              <DialogDescription>{selected?.complaintNumber} — {selected?.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Staff User ID *</Label>
                <Input value={assignForm.staffId} type="number"
                  onChange={e => setAssignForm(p => ({ ...p, staffId: e.target.value }))}
                  placeholder="Enter staff user ID" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
              <Button onClick={handleAssign}>Assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Complaints;
