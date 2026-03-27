import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Building2,
  Plus,
  Pencil,
  Trash2,
  Search,
  MoreVertical,
  Phone,
  Mail,
  Users,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

const ClientManagement: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    logoUrl: '',
    isActive: true,
  });

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const response = await api.clients.getAll();
      if (response.success) {
        setClients(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = clients.filter(
    (client) =>
      (client.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.company ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateClient = async () => {
    if (!newClient.name || !newClient.email || !newClient.company) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await api.clients.create(newClient);
      if (response.success) {
        setClients((prev) => [...prev, response.data]);
        setNewClient({ name: '', email: '', phone: '', company: '', logoUrl: '', isActive: true });
        setIsCreateDialogOpen(false);
        toast.success(`Client ${newClient.name} created successfully`);
      } else {
        toast.error(response.message || 'Failed to create client');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    }
  };

  const handleEditClient = async () => {
    if (!editingClient) return;

    try {
      const response = await api.clients.update(editingClient.id, editingClient);
      if (response.success) {
        setClients((prev) =>
          prev.map((c) => (c.id === editingClient.id ? response.data : c))
        );
        setIsEditDialogOpen(false);
        setEditingClient(null);
        toast.success('Client updated successfully');
      } else {
        toast.error(response.message || 'Failed to update client');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    }
  };

  const handleDeleteClient = async (clientId: number) => {
    try {
      const response = await api.clients.delete(clientId);
      if (response.success) {
        setClients((prev) => prev.filter((c) => c.id !== clientId));
        toast.success('Client deleted successfully');
      } else {
        toast.error(response.message || 'Failed to delete client');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    }
  };

  const activeClients = clients.filter((c) => c.isActive || c.status === 'active' || c.IsActive).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold">Client Management</h1>
            <p className="text-muted-foreground">Manage your clients and their information</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 hover-lift">
                <Plus className="h-4 w-4" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card animate-scale-in max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>
                  Create a new client profile with their details.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Client Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={newClient.name}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    placeholder="Acme Corporation"
                    value={newClient.company}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, company: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="client@company.com"
                    value={newClient.email}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="+1-555-0100"
                    value={newClient.phone}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Client Logo URL</Label>
                  <Input
                    id="logoUrl"
                    placeholder="https://example.com/logo.png"
                    value={newClient.logoUrl}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground italic">provide a direct link to the company's logo image</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={newClient.isActive ? "active" : "inactive"}
                    onValueChange={(value: 'active' | 'inactive') =>
                      setNewClient((prev) => ({ ...prev, isActive: value === 'active' }))
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateClient}>Create Client</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clients.length}</p>
                <p className="text-sm text-muted-foreground">Total Clients</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10">
                <Users className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeClients}</p>
                <p className="text-sm text-muted-foreground">Active Clients</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-lift transition-all duration-300">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/10">
                <Building2 className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clients.length - activeClients}</p>
                <p className="text-sm text-muted-foreground">Inactive Clients</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Table */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg">All Clients</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="border-x">
                  <TableHeader className="bg-primary hover:bg-primary">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-white font-semibold last:border-r-0 h-11">Client</TableHead>
                      <TableHead className="text-white font-semibold last:border-r-0 h-11">Contact</TableHead>
                      <TableHead className="text-white font-semibold last:border-r-0 h-11">Status</TableHead>
                      <TableHead className="text-white font-semibold last:border-r-0 h-11">Created</TableHead>
                      <TableHead className="text-right text-white font-semibold px-4 h-11">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client, index) => (
                      <TableRow
                        key={client.id}
                        className="animate-fade-in hover:bg-slate-50/50"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <TableCell className="border-r border-slate-200 last:border-r-0">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden p-1.5 transition-transform group-hover:scale-105">
                              {client.logoUrl ? (
                                <img src={client.logoUrl} alt={client.name} className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <Building2 className="h-6 w-6 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{client.name}</p>
                              <p className="text-sm text-muted-foreground">{client.company}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="border-r border-slate-200 last:border-r-0">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {client.email}
                            </div>
                            {client.phone && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {client.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="border-r border-slate-200 last:border-r-0">
                          {(() => {
                            const active = client.isActive !== undefined ? client.isActive : (client.IsActive !== undefined ? client.IsActive : client.status === 'active');
                            return (
                              <Badge
                                className={
                                  active
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 capitalize font-medium px-2.5 py-0.5'
                                    : 'bg-red-500/10 text-red-500 border-red-500/20 capitalize font-medium px-2.5 py-0.5'
                                }
                              >
                                <span className={`h-1.5 w-1.5 rounded-full mr-2 ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                {active ? 'Active' : 'Inactive'}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-muted-foreground border-r border-slate-200 last:border-r-0">
                          {client.createdAt ? format(new Date(client.createdAt), 'PPP') : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingClient(client);
                                  setIsEditDialogOpen(true);
                                }}
                                className="cursor-pointer"
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Client
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteClient(client.id)}
                                className="text-destructive cursor-pointer"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Client
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-card animate-scale-in max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
              <DialogDescription>
                Update client information.
              </DialogDescription>
            </DialogHeader>
            {editingClient && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Client Name</Label>
                  <Input
                    id="edit-name"
                    value={editingClient.name}
                    onChange={(e) => setEditingClient((prev) => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-logoUrl">Client Logo URL</Label>
                  <Input
                    id="edit-logoUrl"
                    placeholder="https://example.com/logo.png"
                    value={editingClient.logoUrl || ''}
                    onChange={(e) => setEditingClient((prev) => prev ? { ...prev, logoUrl: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-company">Company</Label>
                  <Input
                    id="edit-company"
                    value={editingClient.company}
                    onChange={(e) => setEditingClient((prev) => prev ? { ...prev, company: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingClient.email}
                    onChange={(e) => setEditingClient((prev) => prev ? { ...prev, email: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editingClient.phone}
                    onChange={(e) => setEditingClient((prev) => prev ? { ...prev, phone: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={(editingClient.isActive ?? editingClient.IsActive ?? (editingClient.status === 'active')) ? "active" : "inactive"}
                    onValueChange={(value: 'active' | 'inactive') =>
                      setEditingClient((prev) => prev ? { ...prev, isActive: value === 'active' } : null)
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditClient}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ClientManagement;
