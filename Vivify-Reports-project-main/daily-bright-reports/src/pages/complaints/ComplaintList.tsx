import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  Filter, 
  Search, 
  MessageSquare, 
  UserPlus, 
  CheckCircle, 
  Clock,
  MoreVertical,
  Plus
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const ComplaintList = () => {
  const { user, isResident, isHelpdesk, isManager, isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery({
    queryKey: ['complaints', statusFilter],
    queryFn: () => api.complaints.getAll({ 
      status: statusFilter === 'all' ? undefined : statusFilter 
    })
  });

  const complaints = response?.data?.items || [];

  const assignMutation = useMutation({
    mutationFn: ({ id, staffId }: { id: number; staffId: number }) => 
      api.complaints.assign(id, { staffId, managerId: Number(user?.id) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      toast.success('Complaint assigned successfully');
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Open</Badge>;
      case 'assigned': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Assigned</Badge>;
      case 'resolved': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Resolved</Badge>;
      case 'closed': return <Badge variant="secondary">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Complaints Management</h1>
          <p className="text-sm text-muted-foreground">Manage and track resident grievances</p>
        </div>
        {isResident && (
          <Button className="gap-2">
            <Plus size={16} /> Raise Complaint
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between bg-card p-4 rounded-xl border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Search by ID, name or category..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setStatusFilter('all')} className={statusFilter === 'all' ? 'bg-accent' : ''}>All</Button>
          <Button variant="outline" size="sm" onClick={() => setStatusFilter('Open')} className={statusFilter === 'Open' ? 'bg-accent' : ''}>Open</Button>
          <Button variant="outline" size="sm" onClick={() => setStatusFilter('Assigned')} className={statusFilter === 'Assigned' ? 'bg-accent' : ''}>Assigned</Button>
          <Button variant="outline" size="sm" onClick={() => setStatusFilter('Resolved')} className={statusFilter === 'Resolved' ? 'bg-accent' : ''}>Resolved</Button>
        </div>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Complaint No</TableHead>
              <TableHead>Resident</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10">Loading complaints...</TableCell></TableRow>
            ) : (complaints).map((c: any) => (
              <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium">{c.complaintNumber}</TableCell>
                <TableCell>{c.resident?.fullName || 'Resident'}</TableCell>
                <TableCell>{c.unit?.unitNumber || 'N/A'}</TableCell>
                <TableCell>{c.category?.categoryName || 'General'}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    c.priority === 'High' ? 'bg-red-100 text-red-700' :
                    c.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {c.priority}
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(c.status)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical size={16} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem className="gap-2"><MessageSquare size={14} /> View Details</DropdownMenuItem>
                      {isHelpdesk && c.status === 'Open' && (
                        <DropdownMenuItem className="gap-2 text-primary">
                          <UserPlus size={14} /> Assign Staff
                        </DropdownMenuItem>
                      )}
                      {(isManager || isAdmin) && (
                        <DropdownMenuItem className="gap-2 text-destructive">Delete</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ComplaintList;
