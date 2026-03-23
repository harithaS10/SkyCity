import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { mockClientsData, mockUsersData, predefinedWorks } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  MessageSquareWarning,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Building2,
  Calendar,
  ArrowRight,
  Loader2,
  Phone,
  Mail,
  FileText,
  Plus,
  Trash2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface Complaint {
  id: string;
  clientId: string;
  productName: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'in-progress' | 'resolved';
  assignedTo?: string;
  assignedWork?: string;
  createdAt: string;
  resolvedAt?: string;
}

const mockComplaints: Complaint[] = [
  {
    id: 'comp1',
    clientId: 'c1',
    productName: 'CRM Software v2.0',
    description: 'Login page is not loading properly on mobile devices. Users are experiencing blank screens after entering credentials.',
    priority: 'high',
    status: 'open',
    createdAt: '2026-01-18T10:30:00',
  },
  {
    id: 'comp2',
    clientId: 'c2',
    productName: 'Inventory Management System',
    description: 'Stock count mismatch between system and actual inventory. Needs urgent investigation.',
    priority: 'critical',
    status: 'assigned',
    assignedTo: '2',
    assignedWork: '06',
    createdAt: '2026-01-17T14:00:00',
  },
  {
    id: 'comp3',
    clientId: 'c3',
    productName: 'HR Portal',
    description: 'Leave application form is not submitting. Employees are unable to apply for leaves.',
    priority: 'medium',
    status: 'in-progress',
    assignedTo: '3',
    assignedWork: '02',
    createdAt: '2026-01-16T09:00:00',
  },
  {
    id: 'comp4',
    clientId: 'c1',
    productName: 'CRM Software v2.0',
    description: 'Dashboard charts not displaying correctly in Firefox browser.',
    priority: 'low',
    status: 'resolved',
    assignedTo: '4',
    assignedWork: '06',
    createdAt: '2026-01-10T11:00:00',
    resolvedAt: '2026-01-15T16:00:00',
  },
];

const priorityColors = {
  low: 'bg-muted text-muted-foreground border-muted',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusColors = {
  open: 'bg-destructive/10 text-destructive border-destructive/20',
  assigned: 'bg-warning/10 text-warning border-warning/20',
  'in-progress': 'bg-primary/10 text-primary border-primary/20',
  resolved: 'bg-success/10 text-success border-success/20',
};

const statusIcons = {
  open: <AlertCircle className="h-4 w-4" />,
  assigned: <Clock className="h-4 w-4" />,
  'in-progress': <Loader2 className="h-4 w-4 animate-spin" />,
  resolved: <CheckCircle2 className="h-4 w-4" />,
};

const Complaints: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [complaints, setComplaints] = useState<Complaint[]>(mockComplaints);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'assigned' | 'in-progress' | 'resolved'>('all');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [assignData, setAssignData] = useState({ assignedTo: '', assignedWork: '' });
  const [newComplaint, setNewComplaint] = useState({
    clientId: '',
    productName: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
  });

  const users = mockUsersData.filter((u) => u.role === 'user' && u.enabled);
  const clients = mockClientsData;

  // Filter complaints based on user role
  const userComplaints = isAdmin
    ? complaints
    : complaints.filter(c => c.assignedTo === user?.id);

  const filteredComplaints = userComplaints.filter((complaint) => {
    const matchesSearch =
      complaint.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      complaint.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getClientName(complaint.clientId).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || complaint.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getClientName = (clientId: string) =>
    mockClientsData.find((c) => c.id === clientId)?.name || 'Unknown';

  const getClientDetails = (clientId: string) =>
    mockClientsData.find((c) => c.id === clientId);

  const getUserName = (userId?: string) =>
    userId ? mockUsersData.find((u) => u.id === userId)?.name : 'Unassigned';

  const getWorkTitle = (workCode?: string) =>
    workCode ? predefinedWorks.find((w) => w.code === workCode)?.title : 'N/A';

  const handleAssign = () => {
    if (!selectedComplaint || !assignData.assignedTo || !assignData.assignedWork) {
      toast.error('Please select both employee and work type');
      return;
    }

    setComplaints((prev) =>
      prev.map((c) =>
        c.id === selectedComplaint.id
          ? { ...c, ...assignData, status: 'assigned' as const }
          : c
      )
    );
    setIsAssignDialogOpen(false);
    setSelectedComplaint(null);
    setAssignData({ assignedTo: '', assignedWork: '' });
    toast.success('Complaint assigned successfully');
  };

  const handleCreateComplaint = () => {
    if (!newComplaint.clientId || !newComplaint.productName || !newComplaint.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    const complaint: Complaint = {
      id: `comp${Date.now()}`,
      ...newComplaint,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    setComplaints((prev) => [complaint, ...prev]);
    setIsCreateDialogOpen(false);
    setNewComplaint({ clientId: '', productName: '', description: '', priority: 'medium' });
    toast.success('Complaint created successfully');
  };

  const handleUpdateStatus = (complaintId: string, newStatus: 'in-progress' | 'resolved') => {
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === complaintId
          ? {
            ...c,
            status: newStatus,
            resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : undefined
          }
          : c
      )
    );
    toast.success(`Complaint marked as ${newStatus}`);
  };

  const openAssignDialog = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setAssignData({
      assignedTo: complaint.assignedTo || '',
      assignedWork: complaint.assignedWork || ''
    });
    setIsAssignDialogOpen(true);
  };

  const openCount = complaints.filter((c) => c.status === 'open').length;
  const assignedCount = complaints.filter((c) => c.status === 'assigned').length;
  const inProgressCount = complaints.filter((c) => c.status === 'in-progress').length;
  const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquareWarning className="h-7 w-7 text-primary" />
              {isAdmin ? 'Complaint Management' : 'My Assigned Complaints'}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? 'Manage and assign client complaints to your team'
                : 'View and resolve complaints assigned to you'}
            </p>
          </div>
          <div className="flex gap-2">
            {resolvedCount > 0 && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Are you sure you want to clear all resolved complaints?')) {
                    setComplaints(prev => prev.filter(c => c.status !== 'resolved'));
                    toast.success('Resolved complaints cleared');
                  }
                }}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear Resolved
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="gap-2 hover-lift bg-gradient-to-r from-primary to-primary/80"
              >
                <Plus className="h-4 w-4" />
                Add Complaint
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Card
            className="hover-lift transition-all duration-300 cursor-pointer"
            onClick={() => setFilterStatus('open')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openCount}</p>
                <p className="text-sm text-muted-foreground">Open</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className="hover-lift transition-all duration-300 cursor-pointer"
            onClick={() => setFilterStatus('assigned')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-warning/20 to-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{assignedCount}</p>
                <p className="text-sm text-muted-foreground">Assigned</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className="hover-lift transition-all duration-300 cursor-pointer"
            onClick={() => setFilterStatus('in-progress')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                <Loader2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressCount}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className="hover-lift transition-all duration-300 cursor-pointer"
            onClick={() => setFilterStatus('resolved')}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-success/20 to-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resolvedCount}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search complaints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)} className="w-full sm:w-auto">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
              <TabsTrigger value="open" className="text-xs sm:text-sm">Open</TabsTrigger>
              <TabsTrigger value="assigned" className="text-xs sm:text-sm">Assigned</TabsTrigger>
              <TabsTrigger value="in-progress" className="text-xs sm:text-sm">In Progress</TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs sm:text-sm">Resolved</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Complaints Grid */}
        <div className="grid gap-4 md:grid-cols-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {filteredComplaints.length === 0 ? (
            <Card className="md:col-span-2 p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <MessageSquareWarning className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">No complaints found</p>
              </div>
            </Card>
          ) : (
            filteredComplaints.map((complaint, index) => {
              const client = getClientDetails(complaint.clientId);
              return (
                <Card
                  key={complaint.id}
                  className="hover-lift transition-all duration-300 animate-fade-in overflow-hidden"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {complaint.productName}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Building2 className="h-3 w-3" />
                          {getClientName(complaint.clientId)}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge className={priorityColors[complaint.priority]} variant="outline">
                          {complaint.priority}
                        </Badge>
                        <Badge className={statusColors[complaint.status]} variant="outline">
                          <span className="flex items-center gap-1">
                            {statusIcons[complaint.status]}
                            {complaint.status}
                          </span>
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {complaint.description}
                    </p>

                    {/* Client Contact Info */}
                    {client && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {client.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {client.phone}
                        </span>
                      </div>
                    )}

                    {/* Assignment Info */}
                    {complaint.assignedTo && (
                      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-sm">
                        <User className="h-4 w-4 text-primary" />
                        <span>{getUserName(complaint.assignedTo)}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <FileText className="h-4 w-4 text-primary" />
                        <span>{getWorkTitle(complaint.assignedWork)}</span>
                      </div>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(complaint.createdAt), { addSuffix: true })}
                      </span>
                      {complaint.resolvedAt && (
                        <span className="text-success">
                          Resolved {formatDistanceToNow(new Date(complaint.resolvedAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t">
                      {isAdmin && complaint.status === 'open' && (
                        <Button
                          size="sm"
                          onClick={() => openAssignDialog(complaint)}
                          className="flex-1 gap-2"
                        >
                          <User className="h-4 w-4" />
                          Assign
                        </Button>
                      )}
                      {isAdmin && complaint.status === 'assigned' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAssignDialog(complaint)}
                          className="flex-1 gap-2"
                        >
                          <User className="h-4 w-4" />
                          Reassign
                        </Button>
                      )}
                      {!isAdmin && complaint.status === 'assigned' && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(complaint.id, 'in-progress')}
                          className="flex-1 gap-2"
                        >
                          <Loader2 className="h-4 w-4" />
                          Start Working
                        </Button>
                      )}
                      {!isAdmin && complaint.status === 'in-progress' && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(complaint.id, 'resolved')}
                          className="flex-1 gap-2 bg-success hover:bg-success/90"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Mark Resolved
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Assign Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="bg-card animate-scale-in">
            <DialogHeader>
              <DialogTitle>Assign Complaint</DialogTitle>
              <DialogDescription>
                Select an employee and work type to assign this complaint.
              </DialogDescription>
            </DialogHeader>
            {selectedComplaint && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="font-medium text-sm">{selectedComplaint.productName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedComplaint.description}</p>
                </div>
                <div className="space-y-2">
                  <Label>Assign To *</Label>
                  <Select
                    value={assignData.assignedTo}
                    onValueChange={(value) => setAssignData((prev) => ({ ...prev, assignedTo: value }))}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work Type *</Label>
                  <Select
                    value={assignData.assignedWork}
                    onValueChange={(value) => setAssignData((prev) => ({ ...prev, assignedWork: value }))}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select work type" />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      {predefinedWorks.map((work) => (
                        <SelectItem key={work.code} value={work.code}>
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-primary/10 text-primary px-1 rounded">
                              {work.code}
                            </span>
                            {work.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign}>Assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Complaint Dialog (Admin only) */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="bg-card animate-scale-in">
            <DialogHeader>
              <DialogTitle>Add New Complaint</DialogTitle>
              <DialogDescription>
                Record a new client complaint for assignment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select
                  value={newComplaint.clientId}
                  onValueChange={(value) => setNewComplaint((prev) => ({ ...prev, clientId: value }))}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} - {client.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input
                  placeholder="e.g., CRM Software v2.0"
                  value={newComplaint.productName}
                  onChange={(e) => setNewComplaint((prev) => ({ ...prev, productName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  placeholder="Describe the complaint in detail..."
                  value={newComplaint.description}
                  onChange={(e) => setNewComplaint((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newComplaint.priority}
                  onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') =>
                    setNewComplaint((prev) => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateComplaint}>Create Complaint</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Complaints;
