import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { downloadCSV } from '@/lib/downloadUtils';
import { cn } from '@/lib/utils';
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
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { format } from 'date-fns';

const ClientManagement: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: string[] } | null>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
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

    // Frontend duplicate check
    const nameDup = clients.find(c => c.name?.toLowerCase() === newClient.name.toLowerCase());
    if (nameDup) { toast.error(`A client named "${nameDup.name}" already exists.`); return; }
    const emailDup = clients.find(c => c.email?.toLowerCase() === newClient.email.toLowerCase());
    if (emailDup) { toast.error(`Email "${emailDup.email}" is already used by "${emailDup.name}".`); return; }

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
      const msg = error?.response?.data?.message || error?.response?.data?.errors?.dto?.[0] || error?.message || 'An error occurred';
      toast.error(msg);
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

  const downloadTemplate = async () => {
    const csv = 'name,company,email,phone\nJohn Doe,Acme Corp,john@acme.com,9876543210\nJane Smith,Beta Ltd,jane@beta.com,9876543211';
    await downloadCSV(csv, 'clients_template.csv', 'Clients Upload Template');
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBulkCsvText(ev.target?.result as string ?? '');
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseCsvClients = (csv: string) => {
    const lines = csv.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj.name && obj.email && obj.company
        ? { name: obj.name, company: obj.company, email: obj.email, phone: obj.phone || '', isActive: true }
        : null;
    }).filter(Boolean);
  };

  const handleBulkUpload = async () => {
    const items = parseCsvClients(bulkCsvText);
    if (!items.length) { toast.error('No valid rows found. Check the CSV format.'); return; }

    // Frontend duplicate check — filter out rows that already exist locally
    const existingNames = new Set(clients.map(c => c.name?.toLowerCase()));
    const existingEmails = new Set(clients.map(c => c.email?.toLowerCase()));
    const skippedLocally: string[] = [];
    const uniqueItems = items.filter((item: any) => {
      if (existingNames.has(item.name?.toLowerCase())) {
        skippedLocally.push(`"${item.name}" already exists`);
        return false;
      }
      if (existingEmails.has(item.email?.toLowerCase())) {
        skippedLocally.push(`Email "${item.email}" already exists`);
        return false;
      }
      // Track within batch
      existingNames.add(item.name?.toLowerCase());
      existingEmails.add(item.email?.toLowerCase());
      return true;
    });

    if (!uniqueItems.length) {
      setBulkResult({ created: 0, errors: skippedLocally });
      toast.error('All rows are duplicates — nothing to upload.');
      return;
    }

    setIsBulkUploading(true);
    setBulkResult(null);
    try {
      const res = await api.clients.bulkCreate(uniqueItems);
      if (res.success) {
        // Handle both old (array) and new ({ created, skipped, skippedDetails }) response shapes
        const created = res.data?.created ?? res.data?.length ?? uniqueItems.length;
        const serverSkipped: string[] = res.data?.skippedDetails ?? [];
        const allSkipped = [...skippedLocally, ...serverSkipped];
        setBulkResult({ created, errors: allSkipped });
        if (created > 0) {
          toast.success(`${created} client${created !== 1 ? 's' : ''} created`);
          fetchClients();
        }
        if (allSkipped.length > 0) {
          toast.warning(`${allSkipped.length} row${allSkipped.length !== 1 ? 's' : ''} skipped (duplicates)`);
        }
      } else {
        toast.error(res.message || 'Bulk upload failed');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Bulk upload failed';
      toast.error(msg);
    } finally {
      setIsBulkUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        
        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden sm:block space-y-6 mb-6 pt-2">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
            <div>
              <h1 className="text-2xl font-bold">Client Management</h1>
              <p className="text-muted-foreground">Manage your clients and their information</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={() => { setBulkCsvText(''); setBulkResult(null); setIsBulkDialogOpen(true); }}>
                <Upload className="h-4 w-4" />
                Bulk Upload
              </Button>
              <Button className="gap-2 hover-lift" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Client
              </Button>
            </div>
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
                  <Table className="border-x table-fixed w-full">
                    <colgroup>
                      <col style={{ width: '56px' }} />
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '80px' }} />
                    </colgroup>
                    <TableHeader className="bg-primary hover:bg-primary">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-white font-semibold h-11 text-center">S/No</TableHead>
                        <TableHead className="text-white font-semibold h-11">Client</TableHead>
                        <TableHead className="text-white font-semibold h-11">Contact</TableHead>
                        <TableHead className="text-white font-semibold h-11">Status</TableHead>
                        <TableHead className="text-white font-semibold h-11">Created</TableHead>
                        <TableHead className="text-right text-white font-semibold px-4 h-11">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  </Table>
                  <div className="overflow-y-auto" style={{ maxHeight: '392px' }}>
                    <Table className="border-x table-fixed w-full">
                      <colgroup>
                        <col style={{ width: '56px' }} />
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '80px' }} />
                      </colgroup>
                      <TableBody>
                        {filteredClients.map((client, index) => (
                          <TableRow
                            key={client.id}
                            className="animate-fade-in hover:bg-slate-50/50"
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <TableCell className="border-r border-slate-200 w-12 text-center text-slate-500 text-sm font-medium">{index + 1}</TableCell>
                            <TableCell className="border-r border-slate-200">
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
                            <TableCell className="border-r border-slate-200">
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
                            <TableCell className="border-r border-slate-200">
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
                            <TableCell className="text-muted-foreground border-r border-slate-200">
                              {client.createdAt ? format(new Date(client.createdAt), 'PPP') : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => { setEditingClient(client); setIsEditDialogOpen(true); }}
                                  className="hover:text-primary hover:bg-primary/10"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-card">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Client?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete "{client.name}". This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteClient(client.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="block sm:hidden bg-slate-50 dark:bg-slate-950 -mx-4 -mt-4 min-h-screen">
          <div className="bg-primary pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black text-white tracking-tight truncate">Clients</h1>
                <p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Client Management</p>
              </div>
              <Button variant="ghost" className="bg-white/10 text-white rounded-2xl h-11 w-11 p-0 shrink-0 backdrop-blur-md border-0 hover:bg-white/20" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-6 w-6" />
              </Button>
              <Button variant="ghost" className="bg-white/10 text-white rounded-2xl h-11 w-11 p-0 shrink-0 backdrop-blur-md border-0 hover:bg-white/20" onClick={() => { setBulkCsvText(''); setBulkResult(null); setIsBulkDialogOpen(true); }}>
                <Upload className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <Building2 className="h-5 w-5 text-white mb-1.5 opacity-80" />
                <p className="text-2xl font-black">{clients.length}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Total Clients</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <Users className="h-5 w-5 text-emerald-300 mb-1.5 opacity-80" />
                <p className="text-2xl font-black">{activeClients}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Active</p>
              </div>
            </div>
          </div>

          <div className="px-5 -mt-6 relative z-20 space-y-4 pb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-12 pr-4 rounded-2xl bg-white dark:bg-slate-800 border-none shadow-xl ring-1 ring-black/5 dark:ring-white/5 font-bold text-sm dark:text-white"
              />
            </div>

            <div className="space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50 bg-white dark:bg-slate-800 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Loading clients...</p>
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50 bg-white dark:bg-slate-800 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                  <Building2 className="h-8 w-8 mb-2 text-slate-400 dark:text-slate-500" />
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No clients found</p>
                </div>
              ) : (
                filteredClients.map((client) => {
                  const active = client.isActive !== undefined ? client.isActive : (client.IsActive !== undefined ? client.IsActive : client.status === 'active');
                  return (
                    <div key={client.id} className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col gap-3">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-700 shadow-sm ring-1 ring-slate-100 dark:ring-slate-600 overflow-hidden shrink-0 p-1.5">
                          {client.logoUrl ? (
                            <img src={client.logoUrl} alt={client.name} className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <Building2 className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-slate-800 dark:text-white truncate">{client.name}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">{client.company}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-2 border-slate-100 dark:border-slate-700">
                            <DropdownMenuItem onClick={() => { setEditingClient(client); setIsEditDialogOpen(true); }} className="cursor-pointer text-xs font-bold rounded-xl py-2 px-3 dark:text-white dark:hover:bg-slate-700">
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Client
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteClient(client.id)} className="text-rose-600 dark:text-rose-400 cursor-pointer text-xs font-bold rounded-xl py-2 px-3 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-700 dark:hover:text-rose-300">
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="flex flex-col gap-2 pt-3 border-t border-slate-50 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{client.email}</span>
                          </div>
                          {client.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0 ml-2">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{client.phone}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-xl self-start mt-1 border border-slate-100 dark:border-slate-600 shadow-sm">
                          <span className={cn("text-[9px] font-black uppercase tracking-widest", active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")}>
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ===== SHARED CREATE DIALOG ===== */}
        <Dialog open={isCreateDialogOpen} onOpenChange={(o) => {
          setIsCreateDialogOpen(o);
          if (!o) setNewClient({ name: '', email: '', phone: '', company: '', logoUrl: '', isActive: true });
        }}>
          <DialogContent className="bg-card animate-scale-in max-h-[90vh] overflow-y-auto sm:max-w-lg rounded-3xl sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Create a new client profile with their details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name *</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={newClient.name}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, name: e.target.value }))}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Input
                  id="company"
                  placeholder="Acme Corporation"
                  value={newClient.company}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, company: e.target.value }))}
                  className="rounded-xl h-11"
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
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1-555-0100"
                  value={newClient.phone}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, phone: e.target.value }))}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Client Logo URL</Label>
                <Input
                  id="logoUrl"
                  placeholder="https://example.com/logo.png"
                  value={newClient.logoUrl}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  className="rounded-xl h-11"
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
                  <SelectTrigger className="bg-background rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card rounded-2xl">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => {
                setNewClient({ name: '', email: '', phone: '', company: '', logoUrl: '', isActive: true });
              }} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleCreateClient} className="rounded-xl">Create Client</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== SHARED EDIT DIALOG ===== */}
        <Dialog open={isEditDialogOpen} onOpenChange={(o) => {
          setIsEditDialogOpen(o);
          if (!o) setEditingClient((prev: any) => prev ? { ...prev, name: '', email: '', phone: '', company: '', logoUrl: '' } : null);
        }}>
          <DialogContent className="bg-card animate-scale-in max-h-[90vh] overflow-y-auto sm:max-w-lg rounded-3xl sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
              <DialogDescription>
                Update client information.
              </DialogDescription>
            </DialogHeader>
            {editingClient && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Client Name</Label>
                  <Input
                    id="edit-name"
                    value={editingClient.name}
                    onChange={(e) => setEditingClient((prev: any) => prev ? { ...prev, name: e.target.value } : null)}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-logoUrl">Client Logo URL</Label>
                  <Input
                    id="edit-logoUrl"
                    placeholder="https://example.com/logo.png"
                    value={editingClient.logoUrl || ''}
                    onChange={(e) => setEditingClient((prev: any) => prev ? { ...prev, logoUrl: e.target.value } : null)}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-company">Company</Label>
                  <Input
                    id="edit-company"
                    value={editingClient.company}
                    onChange={(e) => setEditingClient((prev: any) => prev ? { ...prev, company: e.target.value } : null)}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingClient.email}
                    onChange={(e) => setEditingClient((prev: any) => prev ? { ...prev, email: e.target.value } : null)}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editingClient.phone}
                    onChange={(e) => setEditingClient((prev: any) => prev ? { ...prev, phone: e.target.value } : null)}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={(editingClient.isActive ?? editingClient.IsActive ?? (editingClient.status === 'active')) ? "active" : "inactive"}
                    onValueChange={(value: 'active' | 'inactive') =>
                      setEditingClient((prev: any) => prev ? { ...prev, isActive: value === 'active' } : null)
                    }
                  >
                    <SelectTrigger className="bg-background rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card rounded-2xl">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => {
                setEditingClient((prev: any) => prev ? { ...prev, name: '', email: '', phone: '', company: '', logoUrl: '' } : null);
              }} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleEditClient} className="rounded-xl">Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== BULK UPLOAD DIALOG ===== */}
        <Dialog open={isBulkDialogOpen} onOpenChange={(o) => { setIsBulkDialogOpen(o); if (!o) { setBulkResult(null); setBulkCsvText(''); } }}>
          <DialogContent className="bg-card sm:max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Bulk Upload Clients
              </DialogTitle>
              <DialogDescription>Upload a CSV file to create multiple clients at once.</DialogDescription>
            </DialogHeader>
            {!bulkResult ? (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Download Template</p>
                    <p className="text-xs text-slate-500">Columns: name, company, email, phone</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={downloadTemplate}>
                    <Download className="h-3.5 w-3.5" /> Template
                  </Button>
                </div>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => bulkFileRef.current?.click()}>
                  <input ref={bulkFileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleBulkFileUpload} />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-600">Click to upload CSV file</p>
                  <p className="text-xs text-slate-400 mt-1">or paste CSV data below</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Or paste CSV data</Label>
                  <textarea className="w-full h-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder={"name,company,email,phone\nJohn Doe,Acme Corp,john@acme.com,9876543210"}
                    value={bulkCsvText} onChange={e => setBulkCsvText(e.target.value)} />
                </div>
                {bulkCsvText && <p className="text-xs text-slate-500"><span className="font-semibold text-primary">{parseCsvClients(bulkCsvText).length}</span> valid rows detected</p>}
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-sm font-semibold text-emerald-700">{bulkResult.created} clients created successfully</p>
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <p className="text-xs font-semibold text-amber-700">{bulkResult.errors.length} skipped</p>
                    </div>
                    {bulkResult.errors.map((e, i) => <p key={i} className="text-xs text-amber-600 pl-6">{e}</p>)}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setBulkCsvText('');
                setBulkResult(null);
              }}>Cancel</Button>
              {!bulkResult && (
                <Button onClick={handleBulkUpload} disabled={isBulkUploading || !bulkCsvText.trim()} className="gap-2">
                  {isBulkUploading ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Uploading...</> : <><Upload className="h-4 w-4" />Upload Clients</>}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ClientManagement;