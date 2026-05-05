import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import type { CustomRole } from '@/lib/api';
import { downloadCSV } from '@/lib/downloadUtils';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface Department { id: number; departmentName: string; }
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  UserPlus,
  Trash2,
  Pencil,
  Users,
  Shield,
  User,
  Search,
  MoreVertical,
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

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: any[]; errors: string[] } | null>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'staff',
    departmentId: '',
    roleId: '',
  });

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.users.getAll();
      if (response.success && response.data) {
        setUsers(response.data.map((u: any) => ({
          ...u,
          name: u.fullName || u.name || '',
          email: u.email || u.username || '',
        })));
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // Load departments and custom roles for the create form
    api.departments.getAll().then(r => { if (r.success && r.data) setDepartments(r.data); }).catch(() => {});
    api.roles.getAll().then(r => { if (r.success && r.data) setCustomRoles(r.data); }).catch(() => {});
  }, []);

  const filteredUsers = users.filter(
    (user) =>
      (user.fullName || user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email || user.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.username || !newUser.password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const payload: any = { ...newUser };
      if (newUser.departmentId) payload.departmentId = parseInt(newUser.departmentId, 10);
      if (newUser.roleId) payload.roleId = parseInt(newUser.roleId, 10);
      const response = await api.users.create(payload);
      if (response.success) {
        toast.success(`User ${newUser.name} created successfully`);
        setNewUser({ name: '', username: '', email: '', password: '', role: 'user', departmentId: '', roleId: '' });
        setIsCreateDialogOpen(false);
        fetchUsers();
      } else {
        toast.error(response.message || "Failed to create user");
      }
    } catch (error: any) {
      toast.error(error.message || "Error creating user");
    }
  };

  const handleEditClick = (user: any) => {
    setEditingUser({
      id: user.id,
      name: user.name || user.fullName || '',
      username: user.username || '',
      email: user.email || '',
      password: '', // Empty password field
      phone: user.phone || '',
      address: user.address || '',
      role: user.role || 'staff',
    });
    setIsEditDialogOpen(true);
  };

  const handleEditUser = async () => {
    if (!editingUser.name || !editingUser.username) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const payload: any = {
        FullName: editingUser.name,
        Username: editingUser.username,
        Email: editingUser.email,
        Phone: editingUser.phone,
        Address: editingUser.address,
        Role: editingUser.role,
      };
      
      // Only include password if it's been changed (not empty)
      if (editingUser.password && editingUser.password.trim()) {
        payload.Password = editingUser.password;
      }
      
      const response = await api.users.update(editingUser.id, payload);
      if (response.success) {
        toast.success(`User updated successfully`);
        setEditingUser(null);
        setIsEditDialogOpen(false);
        fetchUsers();
      } else {
        toast.error(response.message || "Failed to update user");
      }
    } catch (error: any) {
      toast.error(error.message || "Error updating user");
    }
  };

  const handleToggleEnabled = async (userId: number) => {
    try {
      const response = await api.users.toggleStatus(userId);
      if (response.success) {
        toast.success("User status updated");
        fetchUsers();
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!userId) {
      toast.error("Invalid user ID");
      return;
    }

    if (!confirm("Are you sure you want to delete this user? This will also delete all their reports and work allocations.")) return;

    try {
      const response = await api.users.delete(userId);
      if (response.success) {
        toast.success(response.message || "User deleted");
        fetchUsers();
      } else {
        toast.error(response.message || "Failed to delete user");
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete user");
    }
  };

  const handleRoleChange = async (userId: number, role: string) => {
    try {
      const response = await api.users.update(userId, { role });
      if (response.success) {
        toast.success('Role updated successfully');
        fetchUsers();
      }
    } catch (error) {
      toast.error("Failed to update role");
    }
  };

  const totalUserCount = users.length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const activeCount = users.filter((u) => u.status === 'active').length;

  const downloadTemplate = async () => {
    const csv = 'fullName,username,password,role\nJohn Doe,johndoe,Pass@123,staff\nJane Smith,janesmith,Pass@123,staff';
    await downloadCSV(csv, 'users_template.csv', 'Users Upload Template');
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBulkCsvText(ev.target?.result as string ?? '');
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseCsvUsers = (csv: string) => {
    const lines = csv.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return { username: obj.username, password: obj.password, fullName: obj.fullname || obj.fullName || obj.name, role: obj.role || 'staff' };
    }).filter(u => u.username && u.password && u.fullName);
  };

  const handleBulkUpload = async () => {
    const users = parseCsvUsers(bulkCsvText);
    if (!users.length) { toast.error('No valid rows found. Check the CSV format.'); return; }
    setIsBulkUploading(true);
    setBulkResult(null);
    try {
      const res = await api.users.bulkCreate(users);
      if (res.success) {
        setBulkResult(res.data);
        toast.success(`Bulk upload complete: ${res.data?.created?.length ?? 0} users created`);
        fetchUsers();
      } else {
        toast.error(res.message || 'Bulk upload failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Bulk upload failed');
    } finally {
      setIsBulkUploading(false);
    }
  };

  // Header Styling Variables - MATCHING YOUR IMAGE
  const headerBg = "bg-primary"; // Using the brand blue from the main header
  const headerText = "text-white font-semibold last:border-r-0 h-11";
  const cellBorder = "border-r border-slate-200 last:border-r-0";
  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        {/* ===== DESKTOP HEADER & STATS ===== */}
        <div className="hidden sm:block space-y-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">User Management</h1>
              <p className="text-muted-foreground">Create, manage, and configure user accounts</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={() => { setBulkCsvText(''); setBulkResult(null); setIsBulkDialogOpen(true); }}>
                <Upload className="h-4 w-4" />
                Bulk Upload
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card max-h-[90vh] flex flex-col">
                {/* ... Dialog content remains same ... */}
                <DialogHeader className="shrink-0">
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new user to the system. They will be able to log in immediately.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={newUser.name}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      placeholder="johndoe"
                      value={newUser.username}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@company.com"
                      value={newUser.email}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Min. 6 characters"
                      value={newUser.password}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value: string) => setNewUser((prev) => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" avoidCollisions={false} className="bg-card z-[200]">
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="sub_admin">Sub Admin</SelectItem>
                        <SelectItem value="property_manager">Property Manager</SelectItem>
                        <SelectItem value="facility_manager">Facility Manager</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="vendor">Vendor</SelectItem>
                        <SelectItem value="resident">Resident</SelectItem>
                        <SelectItem value="accountant">Accountant</SelectItem>
                        <SelectItem value="helpdesk">Helpdesk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {departments.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="departmentId">Department <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Select
                        value={newUser.departmentId || 'none'}
                        onValueChange={v => setNewUser(p => ({ ...p, departmentId: v === 'none' ? '' : v }))}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent position="popper" side="bottom" avoidCollisions={false} className="bg-card z-[200]">
                          <SelectItem value="none">— No Department —</SelectItem>
                          {departments.map(d => (
                            <SelectItem key={d.id} value={d.id.toString()}>{d.departmentName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {customRoles.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="roleId">Custom Role <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Select
                        value={newUser.roleId || 'none'}
                        onValueChange={v => setNewUser(p => ({ ...p, roleId: v === 'none' ? '' : v }))}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select custom role" />
                        </SelectTrigger>
                        <SelectContent position="popper" side="bottom" avoidCollisions={false} className="bg-card z-[200]">
                          <SelectItem value="none">— No Custom Role —</SelectItem>
                          {customRoles.map(r => (
                            <SelectItem key={r.id} value={r.id.toString()}>{r.roleName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Footer inside scroll area so Custom Role is never at the very bottom */}
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateUser}>Create User</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="bg-card max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>
                    Update user information. Leave password blank to keep current password.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
                  {editingUser && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Full Name *</Label>
                        <Input
                          id="edit-name"
                          placeholder="John Doe"
                          value={editingUser.name}
                          onChange={(e) => setEditingUser((prev: any) => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-username">Username *</Label>
                        <Input
                          id="edit-username"
                          placeholder="johndoe"
                          value={editingUser.username}
                          onChange={(e) => setEditingUser((prev: any) => ({ ...prev, username: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-email">Email</Label>
                        <Input
                          id="edit-email"
                          type="email"
                          placeholder="john@company.com"
                          value={editingUser.email}
                          onChange={(e) => setEditingUser((prev: any) => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-password">Password <span className="text-muted-foreground text-xs">(optional - leave blank to keep current)</span></Label>
                        <Input
                          id="edit-password"
                          type="password"
                          placeholder="Enter new password or leave blank"
                          value={editingUser.password}
                          onChange={(e) => setEditingUser((prev: any) => ({ ...prev, password: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-phone">Phone</Label>
                        <Input
                          id="edit-phone"
                          placeholder="1234567890"
                          value={editingUser.phone}
                          onChange={(e) => setEditingUser((prev: any) => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-address">Address</Label>
                        <Input
                          id="edit-address"
                          placeholder="123 Main St"
                          value={editingUser.address}
                          onChange={(e) => setEditingUser((prev: any) => ({ ...prev, address: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-role">Role *</Label>
                        <Select
                          value={editingUser.role}
                          onValueChange={(value: string) => setEditingUser((prev: any) => ({ ...prev, role: value }))}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" side="bottom" avoidCollisions={false} className="bg-card z-[200]">
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="sub_admin">Sub Admin</SelectItem>
                            <SelectItem value="property_manager">Property Manager</SelectItem>
                            <SelectItem value="facility_manager">Facility Manager</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="vendor">Vendor</SelectItem>
                            <SelectItem value="resident">Resident</SelectItem>
                            <SelectItem value="accountant">Accountant</SelectItem>
                            <SelectItem value="helpdesk">Helpdesk</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleEditUser}>Update User</Button>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUserCount}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100/50">
                  <Shield className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{adminCount}</p>
                  <p className="text-sm text-muted-foreground">Administrators</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100/50">
                  <User className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCount}</p>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden border-none shadow-md">
            <CardHeader className="bg-white dark:bg-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-lg dark:text-white">All Users</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-400"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border border-slate-200 m-6 mt-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table className="border-x table-fixed w-full">
                    <colgroup>
                      <col style={{ width: '56px' }} />
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '80px' }} />
                    </colgroup>
                    <TableHeader className={`${headerBg} hover:${headerBg}`}>
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className={`${headerText} text-center`}>S/No</TableHead>
                        <TableHead className={headerText}>User</TableHead>
                        <TableHead className={headerText}>Role</TableHead>
                        <TableHead className={headerText}>Status</TableHead>
                        <TableHead className={headerText}>Created</TableHead>
                        <TableHead className="text-right text-white font-semibold px-4 h-11">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  </Table>
                  <div className="overflow-y-auto" style={{ maxHeight: '392px' }}>
                    <Table className="border-x table-fixed w-full">
                      <colgroup>
                        <col style={{ width: '56px' }} />
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '80px' }} />
                      </colgroup>
                      <TableBody>
                        {filteredUsers.map((user, index) => (
                          <TableRow key={user.id} className="hover:bg-slate-50/50">
                            <TableCell className={`${cellBorder} w-12 text-center text-slate-500 text-sm font-medium`}>{index + 1}</TableCell>
                            <TableCell className={cellBorder}>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                                  <User className="h-4 w-4 text-slate-500" />
                                </div>
                                <div>
                                  <p className="font-medium">{user.name}</p>
                                  <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className={cellBorder}>
                              <Select value={user.role} onValueChange={(value: string) => handleRoleChange(user.id, value)}>
                                <SelectTrigger className="w-32 h-8 bg-background border-slate-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card">
                                  <SelectItem value="super_admin">Super Admin</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="sub_admin">Sub Admin</SelectItem>
                                  <SelectItem value="property_manager">Property Manager</SelectItem>
                                  <SelectItem value="facility_manager">Facility Manager</SelectItem>
                                  <SelectItem value="staff">Staff</SelectItem>
                                  <SelectItem value="vendor">Vendor</SelectItem>
                                  <SelectItem value="resident">Resident</SelectItem>
                                  <SelectItem value="accountant">Accountant</SelectItem>
                                  <SelectItem value="helpdesk">Helpdesk</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className={cellBorder}>
                              <div className="flex items-center gap-2">
                                <Switch checked={user.status === 'active'} onCheckedChange={() => handleToggleEnabled(user.id)} />
                                <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="px-2 py-0 text-[10px]">
                                  {user.status === 'active' ? 'Active' : 'Disabled'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className={`${cellBorder} text-slate-500 text-sm`}>
                              {format(parseISO(user.createdAt), 'MMM dd, yyyy')}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditClick(user)}
                                  className="hover:text-primary hover:bg-primary/10"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="block sm:hidden bg-slate-50 dark:bg-slate-900 -mx-4 -mt-4 min-h-[calc(100vh-5rem)]">
          <div className="bg-primary pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black text-white tracking-tight truncate">Users</h1>
                <p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Create, manage, and configure user accounts</p>
              </div>
              <Button variant="ghost" className="bg-white/10 text-white rounded-2xl h-11 w-11 p-0 shrink-0 backdrop-blur-md border-0" onClick={() => setIsCreateDialogOpen(true)}>
                <UserPlus className="h-5 w-5" />
              </Button>
              <Button variant="ghost" className="bg-white/10 text-white rounded-2xl h-11 w-11 p-0 shrink-0 backdrop-blur-md border-0" onClick={() => { setBulkCsvText(''); setBulkResult(null); setIsBulkDialogOpen(true); }}>
                <Upload className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <Users className="h-4 w-4 text-white mb-1 opacity-80" />
                <p className="text-xl font-black">{totalUserCount}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Total</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <Shield className="h-4 w-4 text-amber-300 mb-1 opacity-80" />
                <p className="text-xl font-black">{adminCount}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Admins</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <User className="h-4 w-4 text-emerald-300 mb-1 opacity-80" />
                <p className="text-xl font-black">{activeCount}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Active</p>
              </div>
            </div>
          </div>

          <div className="px-5 -mt-6 relative z-20 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-12 pr-4 rounded-2xl bg-white border-none shadow-xl ring-1 ring-black/5 font-bold text-sm"
              />
            </div>

            <div className="space-y-3 pb-6">
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <p className="text-sm font-bold text-slate-500">No users found</p>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const initials = (user.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                  const roleColor =
                    user.role === 'admin' || user.role === 'super_admin' ? 'bg-amber-100 text-amber-700' :
                    user.role === 'staff' ? 'bg-blue-100 text-blue-700' :
                    user.role === 'resident' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-700';
                  
                  return (
                    <div key={user.id} className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10 flex flex-col gap-3">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 shadow-sm ${roleColor}`}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate mb-0.5">{user.name}</h4>
                          <p className="text-xs text-slate-400 font-medium truncate">{user.email}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 text-slate-500">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white rounded-2xl shadow-xl p-2 border-slate-100">
                            <DropdownMenuItem onClick={() => handleEditClick(user)} className="text-primary cursor-pointer text-xs font-bold rounded-xl py-2 px-3 hover:bg-primary/10 focus:bg-primary/10">
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="text-rose-600 cursor-pointer text-xs font-bold rounded-xl py-2 px-3 hover:bg-rose-50 hover:text-rose-700 focus:bg-rose-50 focus:text-rose-700">
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-50 dark:border-slate-700">
                        <div className="flex-1 min-w-0">
                          <Select value={user.role} onValueChange={(value: string) => handleRoleChange(user.id, value)}>
                            <SelectTrigger className="w-full h-9 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card rounded-2xl shadow-xl border-slate-100">
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="sub_admin">Sub Admin</SelectItem>
                              <SelectItem value="property_manager">Property Manager</SelectItem>
                              <SelectItem value="facility_manager">Facility Manager</SelectItem>
                              <SelectItem value="staff">Staff</SelectItem>
                              <SelectItem value="vendor">Vendor</SelectItem>
                              <SelectItem value="resident">Resident</SelectItem>
                              <SelectItem value="accountant">Accountant</SelectItem>
                              <SelectItem value="helpdesk">Helpdesk</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 h-9 rounded-xl shrink-0">
                          <span className={cn("text-[9px] font-black uppercase tracking-widest", user.status === 'active' ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")}>
                            {user.status === 'active' ? 'Active' : 'Disabled'}
                          </span>
                          <Switch checked={user.status === 'active'} onCheckedChange={() => handleToggleEnabled(user.id)} className="scale-75 origin-right" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== BULK UPLOAD DIALOG ===== */}
      <Dialog open={isBulkDialogOpen} onOpenChange={(o) => { setIsBulkDialogOpen(o); if (!o) { setBulkResult(null); setBulkCsvText(''); } }}>
        <DialogContent className="bg-card sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Bulk Upload Users
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file to create multiple users at once.
            </DialogDescription>
          </DialogHeader>

          {!bulkResult ? (
            <div className="space-y-4 py-2">
              {/* Template download */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Download Template</p>
                  <p className="text-xs text-slate-500">CSV with required columns: fullName, username, password, role</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" /> Template
                </Button>
              </div>

              {/* File upload area */}
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => bulkFileRef.current?.click()}
              >
                <input ref={bulkFileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleBulkFileUpload} />
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-semibold text-slate-600">Click to upload CSV file</p>
                <p className="text-xs text-slate-400 mt-1">or paste CSV data below</p>
              </div>

              {/* Manual CSV paste */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Or paste CSV data</Label>
                <textarea
                  className="w-full h-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={"fullName,username,password,role\nJohn Doe,johndoe,Pass@123,staff"}
                  value={bulkCsvText}
                  onChange={e => setBulkCsvText(e.target.value)}
                />
              </div>

              {bulkCsvText && (
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-primary">{parseCsvUsers(bulkCsvText).length}</span> valid rows detected
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-semibold text-emerald-700">{bulkResult.created.length} users created successfully</p>
              </div>
              {bulkResult.errors.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs font-semibold text-amber-700">{bulkResult.errors.length} skipped:</p>
                  </div>
                  {bulkResult.errors.map((e, i) => <p key={i} className="text-xs text-amber-600 pl-6">{e}</p>)}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>Close</Button>
            {!bulkResult && (
              <Button onClick={handleBulkUpload} disabled={isBulkUploading || !bulkCsvText.trim()} className="gap-2">
                {isBulkUploading ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Uploading...</> : <><Upload className="h-4 w-4" />Upload Users</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default UserManagement;