import React, { useState, useEffect } from 'react';
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
import { Shield, Plus, MoreVertical, Pencil, Trash2, Check, X } from 'lucide-react';
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

  const renderPermissionsGrid = () => (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 font-semibold text-left text-muted-foreground">Module</th>
            {PERM_KEYS.map(k => (
              <th key={k} className="px-3 py-2 font-semibold text-center text-muted-foreground capitalize">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map(m => (
            <tr key={m} className="border-t">
              <td className="px-4 py-2 font-medium">{MODULE_LABELS[m]}</td>
              {PERM_KEYS.map(k => {
                const checked = !!(perms as any)[m]?.[k];
                return (
                  <td key={k} className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => togglePerm(m, k)}
                      className={cn(
                        'h-6 w-6 rounded border-2 flex items-center justify-center mx-auto transition-colors',
                        checked ? 'bg-primary border-primary text-white' : 'border-slate-300 hover:border-primary/50'
                      )}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t px-4 py-3 flex items-center justify-between bg-slate-50/50">
        <div>
          <p className="text-sm font-medium">Allow Data Export / Download</p>
          <p className="text-xs text-muted-foreground">Users with this role can export reports and analytics</p>
        </div>
        <Switch checked={canExportPerm} onCheckedChange={setCanExportPerm} />
      </div>
    </div>
  );

  const headerBg = 'bg-primary';
  const headerText = 'text-white font-semibold h-11';

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Role Management</h1>
              <p className="text-muted-foreground text-sm">Create custom roles with module-level permissions</p>
            </div>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={open => { setIsCreateOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />New Role</Button>
            </DialogTrigger>
            <DialogContent className="bg-card max-w-2xl">
              <DialogHeader><DialogTitle>Create Custom Role</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="roleName">Role Name *</Label>
                  <Input id="roleName" placeholder="e.g. Senior Manager" value={roleName} onChange={e => setRoleName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  {renderPermissionsGrid()}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleCreate} disabled={isCreating}>{isCreating ? 'Creating...' : 'Create Role'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={!!editTarget} onOpenChange={v => { if (!v) { setEditTarget(null); resetForm(); } }}>
            <DialogContent className="bg-card max-w-2xl">
              <DialogHeader><DialogTitle>Edit Role — {editTarget?.roleName}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Role Name</Label>
                  <Input value={roleName} onChange={e => setRoleName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  {renderPermissionsGrid()}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditTarget(null); resetForm(); }}>Cancel</Button>
                <Button onClick={handleUpdate}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              <Table>
                <TableHeader className={headerBg}>
                  <TableRow className="hover:bg-transparent border-none">
                    {['Role Name', 'Complaints', 'Work Orders', 'Daily Reports', 'Analytics', 'Chat', 'Export', 'Actions'].map(h => (
                      <TableHead key={h} className={headerText}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : roles.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No custom roles yet. Create your first role.</TableCell></TableRow>
                  ) : roles.map(r => {
                    const p = r.permissions ?? {};
                    const hasAny = (mod: any) => mod && Object.values(mod).some(Boolean);
                    const tick = (v?: boolean) => v
                      ? <Check className="h-6 w-6 text-emerald-500 mx-auto stroke-[3]" />
                      : <X className="h-6 w-6 text-slate-300 mx-auto stroke-[3]" />;
                    return (
                      <TableRow key={r.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium">{r.roleName}</TableCell>
                        <TableCell className="text-center">{tick(hasAny(p.complaints))}</TableCell>
                        <TableCell className="text-center">{tick(hasAny(p.work_orders))}</TableCell>
                        <TableCell className="text-center">{tick(hasAny(p.daily_reports))}</TableCell>
                        <TableCell className="text-center">{tick(hasAny(p.analytics))}</TableCell>
                        <TableCell className="text-center">{tick(hasAny(p.chat))}</TableCell>
                        <TableCell className="text-center">{tick(p.export)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card">
                              <DropdownMenuItem onClick={() => openEdit(r)} className="cursor-pointer">
                                <Pencil className="mr-2 h-4 w-4" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(r.id, r.roleName)} className="text-destructive cursor-pointer">
                                <Trash2 className="mr-2 h-4 w-4" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default RoleManagement;
