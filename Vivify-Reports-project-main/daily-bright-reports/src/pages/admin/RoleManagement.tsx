import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, CustomRole, RolePermissions, PermissionSet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Shield, Plus, MoreVertical, Pencil, Trash2, Check, X, Upload, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Permissions Matrix ────────────────────────────────────────────────────

const MODULES = ['complaints', 'work_orders', 'daily_reports', 'analytics', 'chat'] as const;
const PERM_KEYS = ['view', 'create', 'edit', 'delete'] as const;

const MODULE_LABELS: Record<typeof MODULES[number], string> = {
  complaints: 'Complaints',
  work_orders: 'Work Orders',
  daily_reports: 'Daily Reports',
  analytics: 'Analytics',
  chat: 'Community Chat',
};

type ModuleKey = typeof MODULES[number];
type PermKey = typeof PERM_KEYS[number];

const defaultPermissions = (): RolePermissions =>
  Object.fromEntries(
    MODULES.map(m => [m, Object.fromEntries(PERM_KEYS.map(k => [k, false]))])
  ) as RolePermissions;

// ─── Component ────────────────────────────────────────────────────────────────

const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: any[] } | null>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [editTarget, setEditTarget] = useState<CustomRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [perms, setPerms] = useState<RolePermissions>(defaultPermissions());
  const [canExportPerm, setCanExportPerm] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await api.roles.getAll();
      if (res.success && res.data) setRoles(res.data);
    } catch {} finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const togglePerm = (module: ModuleKey, key: PermKey) => {
    setPerms(prev => ({
      ...prev,
      [module]: { ...(prev[module] as PermissionSet), [key]: !(prev[module] as any)?.[key] },
    }));
  };

  const resetForm = () => {
    setRoleName('');
    setPerms(defaultPermissions());
    setCanExportPerm(false);
  };

  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!roleName.trim()) { toast.error('Role name is required'); return; }
    setIsCreating(true);
    try {
      const res = await api.roles.create({ roleName: roleName.trim(), permissions: { ...perms, export: canExportPerm } });
      if (res.success) { toast.success(`Role "${roleName}" created`); resetForm(); setIsCreateOpen(false); load(); }
      else toast.error(res.message || 'Failed');
    } catch (e: any) { toast.error(e.message); }
    finally { setIsCreating(false); }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    const payload = { roleName: roleName.trim(), permissions: { ...perms, export: canExportPerm } };
    try {
      const res = await api.roles.update(editTarget.id, payload);
      if (res.success) {
        toast.success('Role updated');
        // Update local state immediately so re-opening edit shows correct checkboxes
        setRoles(prev => prev.map(r =>
          r.id === editTarget.id
            ? { ...r, roleName: roleName.trim(), permissions: payload.permissions }
            : r
        ));
        setEditTarget(null);
        resetForm();
      } else toast.error(res.message || 'Failed');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete role "${name}"?`)) return;
    try {
      const res = await api.roles.delete(id);
      if (res.success) { toast.success('Role deleted'); load(); }
      else toast.error(res.message || 'Failed');
    } catch (e: any) { toast.error(e.message); }
  };

  const openEdit = (r: CustomRole) => {
    setEditTarget(r);
    setRoleName(r.roleName);
    const hasPerms = r.permissions && Object.keys(r.permissions).some(k => k !== 'export');
    setPerms(hasPerms ? r.permissions : defaultPermissions());
    setCanExportPerm(r.permissions?.export ?? false);
  };

  const downloadTemplate = () => {
    const csv = 'roleName\nSite Manager\nField Supervisor\nData Analyst';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'roles_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBulkCsvText(ev.target?.result as string ?? '');
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseCsvRoles = (csv: string) => {
    const lines = csv.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return [];
    return lines.slice(1).map(line => {
      const name = line.split(',')[0].trim();
      return name ? { roleName: name } : null;
    }).filter(Boolean) as { roleName: string }[];
  };

  const handleBulkUpload = async () => {
    const items = parseCsvRoles(bulkCsvText);
    if (!items.length) { toast.error('No valid rows found. Check the CSV format.'); return; }
    setIsBulkUploading(true);
    setBulkResult(null);
    try {
      const res = await api.roles.bulkCreate(items);
      if (res.success) {
        setBulkResult({ created: res.data || [] });
        toast.success(`Bulk upload complete: ${res.data?.length ?? 0} roles created`);
        load();
      } else {
        toast.error(res.message || 'Bulk upload failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Bulk upload failed');
    } finally {
      setIsBulkUploading(false);
    }
  };

  const renderPermissionsGrid = () => (
    <>
      {/* Desktop View */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-left text-muted-foreground whitespace-nowrap">Module</th>
              {PERM_KEYS.map(k => (
                <th key={k} className="px-3 py-3 font-semibold text-center text-muted-foreground capitalize text-xs">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map(m => (
              <tr key={m} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-sm whitespace-nowrap">{MODULE_LABELS[m]}</td>
                {PERM_KEYS.map(k => {
                  const checked = !!(perms as any)[m]?.[k];
                  return (
                    <td key={k} className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => togglePerm(m, k)}
                        className={cn(
                          'h-6 w-6 rounded border-2 flex items-center justify-center mx-auto transition-colors',
                          checked ? 'bg-[#1e293b] border-[#1e293b] text-white' : 'border-slate-300 hover:border-[#1e293b]/50 bg-white'
                        )}
                      >
                        {checked && <Check className="h-4 w-4 stroke-[3]" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t px-4 py-4 flex items-center justify-between bg-slate-50/50">
          <div>
            <p className="text-sm font-semibold text-slate-800">Allow Data Export / Download</p>
            <p className="text-xs text-muted-foreground mt-0.5">Users with this role can export reports and analytics</p>
          </div>
          <Switch checked={canExportPerm} onCheckedChange={setCanExportPerm} className="shrink-0 ml-4" />
        </div>
      </div>

      {/* Mobile View */}
      <div className="block sm:hidden space-y-4">
        {MODULES.map(m => (
          <div key={m} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <h4 className="font-bold text-slate-800 mb-3">{MODULE_LABELS[m]}</h4>
            <div className="grid grid-cols-2 gap-3">
              {PERM_KEYS.map(k => {
                const checked = !!(perms as any)[m]?.[k];
                return (
                  <div key={k} onClick={() => togglePerm(m, k)} className="flex items-center justify-between bg-white border border-slate-200 p-2.5 rounded-xl shadow-sm cursor-pointer hover:border-[#1e293b]/30 transition-colors">
                    <span className="text-xs font-bold text-slate-600 capitalize">{k}</span>
                    <button
                      type="button"
                      className={cn(
                        'h-6 w-6 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                        checked ? 'bg-[#1e293b] border-[#1e293b] text-white' : 'border-slate-300 bg-white'
                      )}
                    >
                      {checked && <Check className="h-4 w-4 stroke-[3]" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between mt-4">
          <div className="flex-1 pr-4">
            <h4 className="font-bold text-slate-800 text-sm">Data Export</h4>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-tight">Allow downloading reports and analytics</p>
          </div>
          <Switch checked={canExportPerm} onCheckedChange={setCanExportPerm} className="shrink-0" />
        </div>
      </div>
    </>
  );

  const headerBg = 'bg-primary';
  const headerText = 'text-white font-semibold h-11';

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden sm:block space-y-6 mb-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Role Management</h1>
                <p className="text-muted-foreground text-sm">Create custom roles with module-level permissions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={() => { setBulkCsvText(''); setBulkResult(null); setIsBulkDialogOpen(true); }}>
                <Upload className="h-4 w-4" />Bulk Upload
              </Button>
              <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4" />New Role
              </Button>
            </div>
          </div>

          {/* Stats */}
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{roles.length}</p>
                <p className="text-sm text-muted-foreground">Custom Roles Defined</p>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden border-none shadow-md">
            <CardHeader className="bg-white"><CardTitle className="text-lg">All Roles</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border border-slate-200 m-6 mt-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table className="table-fixed w-full">
                    <colgroup>
                      <col style={{ width: '56px' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '100px' }} />
                    </colgroup>
                    <TableHeader className={headerBg}>
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className={`${headerText} text-center`}>S/No</TableHead>
                        <TableHead className={headerText}>Role Name</TableHead>
                        <TableHead className={`${headerText} text-center`}>Complaints</TableHead>
                        <TableHead className={`${headerText} text-center`}>Work Orders</TableHead>
                        <TableHead className={`${headerText} text-center`}>Daily Reports</TableHead>
                        <TableHead className={`${headerText} text-center`}>Analytics</TableHead>
                        <TableHead className={`${headerText} text-center`}>Chat</TableHead>
                        <TableHead className={`${headerText} text-center`}>Export</TableHead>
                        <TableHead className={`${headerText} text-right px-4`}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  </Table>
                  <div className="overflow-y-auto" style={{ maxHeight: '392px' }}>
                    <Table className="table-fixed w-full">
                      <colgroup>
                        <col style={{ width: '56px' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '100px' }} />
                      </colgroup>
                      <TableBody>
                        {isLoading ? (
                          <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                        ) : roles.length === 0 ? (
                          <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No custom roles yet. Create your first role.</TableCell></TableRow>
                        ) : roles.map((r, index) => {
                          const p = r.permissions ?? {};
                          const hasAny = (mod: any) => mod && Object.values(mod).some(Boolean);
                          const tick = (v?: boolean) => v
                            ? <Check className="h-5 w-5 text-emerald-500 mx-auto stroke-[3]" />
                            : <X className="h-5 w-5 text-slate-300 mx-auto stroke-[3]" />;
                          return (
                            <TableRow key={r.id} className="hover:bg-slate-50/50">
                              <TableCell className="border-r border-slate-200 text-center text-slate-500 text-sm font-medium">{index + 1}</TableCell>
                              <TableCell className="font-medium border-r border-slate-200">{r.roleName}</TableCell>
                              <TableCell className="text-center border-r border-slate-200">{tick(hasAny(p.complaints))}</TableCell>
                              <TableCell className="text-center border-r border-slate-200">{tick(hasAny(p.work_orders))}</TableCell>
                              <TableCell className="text-center border-r border-slate-200">{tick(hasAny(p.daily_reports))}</TableCell>
                              <TableCell className="text-center border-r border-slate-200">{tick(hasAny(p.analytics))}</TableCell>
                              <TableCell className="text-center border-r border-slate-200">{tick(hasAny(p.chat))}</TableCell>
                              <TableCell className="text-center border-r border-slate-200">{tick(p.export)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEdit(r)}
                                    className="hover:text-primary hover:bg-primary/10"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(r.id, r.roleName)}
                                    className="hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="block sm:hidden bg-slate-50 -mx-4 -mt-4 min-h-screen">
          <div className="bg-primary pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black tracking-tight truncate">Roles</h1>
                <p className="text-[10px] text-white/70 font-bold uppercase mt-1 italic tracking-widest leading-relaxed">Role Management</p>
              </div>
              <Button variant="ghost" className="bg-white/10 text-white rounded-2xl h-11 w-11 p-0 shrink-0 backdrop-blur-md border-0" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-6 w-6" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 mt-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center gap-4 border border-white/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-black">{roles.length}</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">Total Defined Roles</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 -mt-6 relative z-20 space-y-4 pb-8">
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50 bg-white rounded-3xl shadow-sm ring-1 ring-black/5">
                  <p className="text-sm font-bold text-slate-500">Loading roles...</p>
                </div>
              ) : roles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50 bg-white rounded-3xl shadow-sm ring-1 ring-black/5">
                  <Shield className="h-8 w-8 mb-2 text-slate-400" />
                  <p className="text-sm font-bold text-slate-500">No roles defined</p>
                </div>
              ) : (
                roles.map((r) => {
                  const p = r.permissions ?? {};
                  const hasAny = (mod: any) => mod && Object.values(mod).some(Boolean);
                  
                  // Helper for rendering tick boxes
                  const TickPerm = ({ label, active }: { label: string, active: boolean }) => (
                    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                      {active ? (
                        <Check className="h-5 w-5 text-emerald-500 stroke-[3] mb-1" />
                      ) : (
                        <X className="h-5 w-5 text-slate-300 stroke-[3] mb-1" />
                      )}
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{label}</span>
                    </div>
                  );

                  return (
                    <div key={r.id} className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-black/5 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary shadow-sm shrink-0">
                            <Shield className="h-5 w-5" />
                          </div>
                          <h4 className="text-sm font-black text-slate-800 truncate">{r.roleName}</h4>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl bg-slate-50 text-slate-500">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white rounded-2xl shadow-xl p-2 border-slate-100">
                            <DropdownMenuItem onClick={() => openEdit(r)} className="cursor-pointer text-xs font-bold rounded-xl py-2 px-3">
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(r.id, r.roleName)} className="text-rose-600 cursor-pointer text-xs font-bold rounded-xl py-2 px-3 hover:bg-rose-50 hover:text-rose-700">
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="pt-3 border-t border-slate-50">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Module Access</p>
                        <div className="grid grid-cols-3 gap-2">
                          <TickPerm label="Complaints" active={hasAny(p.complaints)} />
                          <TickPerm label="Works" active={hasAny(p.work_orders)} />
                          <TickPerm label="Reports" active={hasAny(p.daily_reports)} />
                          <TickPerm label="Analytics" active={hasAny(p.analytics)} />
                          <TickPerm label="Chat" active={hasAny(p.chat)} />
                          <TickPerm label="Export" active={!!p.export} />
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
        <Dialog open={isCreateOpen} onOpenChange={open => { setIsCreateOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="bg-card max-h-[90vh] overflow-y-auto max-w-2xl sm:rounded-lg rounded-3xl">
            <DialogHeader><DialogTitle>Create Custom Role</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="roleName">Role Name *</Label>
                <Input className="rounded-xl h-11" id="roleName" placeholder="e.g. Senior Manager" value={roleName} onChange={e => setRoleName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                {renderPermissionsGrid()}
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancel</Button>
              <Button className="rounded-xl" onClick={handleCreate} disabled={isCreating}>{isCreating ? 'Creating...' : 'Create Role'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== SHARED EDIT DIALOG ===== */}
        <Dialog open={!!editTarget} onOpenChange={v => { if (!v) { setEditTarget(null); resetForm(); } }}>
          <DialogContent className="bg-card max-h-[90vh] overflow-y-auto max-w-2xl sm:rounded-lg rounded-3xl">
            <DialogHeader><DialogTitle>Edit Role — {editTarget?.roleName}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Role Name</Label>
                <Input className="rounded-xl h-11" value={roleName} onChange={e => setRoleName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                {renderPermissionsGrid()}
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => { setEditTarget(null); resetForm(); }}>Cancel</Button>
              <Button className="rounded-xl" onClick={handleUpdate}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== BULK UPLOAD DIALOG ===== */}
        <Dialog open={isBulkDialogOpen} onOpenChange={(o) => { setIsBulkDialogOpen(o); if (!o) { setBulkResult(null); setBulkCsvText(''); } }}>
          <DialogContent className="bg-card sm:max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Bulk Upload Roles
              </DialogTitle>
            </DialogHeader>
            {!bulkResult ? (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Download Template</p>
                    <p className="text-xs text-slate-500">Column: roleName</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={downloadTemplate}>
                    <Download className="h-3.5 w-3.5" /> Template
                  </Button>
                </div>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => bulkFileRef.current?.click()}>
                  <input ref={bulkFileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleBulkFileUpload} />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-600">Click to upload CSV file</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Or paste CSV data</Label>
                  <textarea className="w-full h-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder={"roleName\nSite Manager\nField Supervisor"}
                    value={bulkCsvText} onChange={e => setBulkCsvText(e.target.value)} />
                </div>
                {bulkCsvText && <p className="text-xs text-slate-500"><span className="font-semibold text-primary">{parseCsvRoles(bulkCsvText).length}</span> valid rows detected</p>}
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-sm font-semibold text-emerald-700">{bulkResult.created.length} roles created successfully</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>Close</Button>
              {!bulkResult && (
                <Button onClick={handleBulkUpload} disabled={isBulkUploading || !bulkCsvText.trim()} className="gap-2">
                  {isBulkUploading ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Uploading...</> : <><Upload className="h-4 w-4" />Upload</>}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default RoleManagement;