import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { downloadExcel, downloadCSV } from '@/lib/downloadUtils';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useNavigate } from 'react-router-dom';
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
  MoreVertical,
  Eye,
  Edit,
  UserX,
  Upload,
  Download,
  FileSpreadsheet,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

// ── Bulk Upload Types & Helpers ────────────────────────────────────────────

interface BulkUploadRow {
  title: string;
  workCode: string;
  workTitle: string;
  assignedTo: string;
  priority: string;
  dueDate: string;
  description: string;
}

interface BulkResult {
  created: number;
  failed: number;
  errors: string[];
}

function cellToStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(s)) {
    try { return String(Math.round(Number(s))); } catch { return s; }
  }
  return s;
}

function rowToBulkUploadRow(row: unknown): BulkUploadRow {
  if (Array.isArray(row)) {
    return {
      title:      cellToStr(row[0]),
      workCode:   cellToStr(row[1]),
      workTitle:  cellToStr(row[2]),
      assignedTo: cellToStr(row[3]),
      priority:   cellToStr(row[4]),
      dueDate:    cellToStr(row[5]),
      description:cellToStr(row[6]),
    };
  }
  const r = row as Record<string, unknown>;
  const g = (...keys: string[]) => cellToStr(keys.reduce<unknown>((v, k) => v ?? r[k], undefined));
  return {
    title:       g('title', 'Title'),
    workCode:    g('workCode', 'WorkCode', 'work_code'),
    workTitle:   g('workTitle', 'WorkTitle', 'work_title'),
    assignedTo:  g('assignedTo', 'AssignedTo', 'assigned_to'),
    priority:    g('priority', 'Priority'),
    dueDate:     g('dueDate', 'DueDate', 'due_date'),
    description: g('description', 'Description'),
  };
}

function parseBulkCSV(text: string): BulkUploadRow[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return [];
  const first = lines[0].toLowerCase();
  const start = first.includes('title') || first.includes('workcode') ? 1 : 0;
  return lines.slice(start).map(line => rowToBulkUploadRow(line.split(',').map(cellToStr)));
}

function parseBulkExcel(buffer: ArrayBuffer): BulkUploadRow[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length === 0) return [];
  const firstRow = rows[0].map(c => cellToStr(c).toLowerCase());
  const isHeader = firstRow.some(c => c === 'title' || c === 'workcode' || c === 'assignedto');
  return (isHeader ? rows.slice(1) : rows)
    .filter(r => r.some(c => cellToStr(c) !== ''))
    .map(rowToBulkUploadRow);
}

async function downloadBulkExcelTemplate(
  works: Array<{ workCode: string; workTitle: string }> = [],
  users: Array<{ name: string; username?: string }> = []
) {
  const headers = ['title', 'workCode', 'workTitle', 'assignedTo', 'priority', 'dueDate', 'description'];
  const sampleWorks = works.slice(0, 3);
  const sampleUsers = users.slice(0, 3);
  const today = new Date();
  const fmtDate = (offset: number) => { const d = new Date(today); d.setDate(d.getDate() + offset); return d.toISOString().split('T')[0]; };
  const dataRows = sampleWorks.length > 0
    ? sampleWorks.map((w, i) => [`Sample task ${i + 1}`, w.workCode, w.workTitle, sampleUsers[i]?.username || sampleUsers[i]?.name || '', ['high', 'medium', 'low'][i % 3], fmtDate(7 + i * 3), ''])
    : [['Sample task 1', '', '', '', 'medium', fmtDate(7), 'Optional description']];
  const refWorkRows: unknown[][] = [['workCode', 'workTitle']];
  works.forEach(w => refWorkRows.push([w.workCode, w.workTitle]));
  const refUserRows: unknown[][] = [['username / fullName']];
  users.forEach(u => refUserRows.push([u.username || u.name]));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  ws['!cols'] = [18, 14, 20, 16, 10, 12, 28].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Upload Data');
  if (refWorkRows.length > 1) { const wsRef = XLSX.utils.aoa_to_sheet(refWorkRows); wsRef['!cols'] = [16, 24].map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, wsRef, 'Valid Work Categories'); }
  if (refUserRows.length > 1) { const wsUsers = XLSX.utils.aoa_to_sheet(refUserRows); wsUsers['!cols'] = [{ wch: 24 }]; XLSX.utils.book_append_sheet(wb, wsUsers, 'Valid Users'); }
  await downloadExcel(wb, 'work_allocation_bulk_upload_template.xlsx', 'Work Allocation Template');
}

async function downloadBulkCSVTemplate(
  works: Array<{ workCode: string; workTitle: string }> = [],
  users: Array<{ name: string; username?: string }> = []
) {
  const today = new Date();
  const fmtDate = (offset: number) => { const d = new Date(today); d.setDate(d.getDate() + offset); return d.toISOString().split('T')[0]; };
  const lines = ['title,workCode,workTitle,assignedTo,priority,dueDate,description'];
  if (works.length > 0) {
    works.slice(0, 3).forEach((w, i) => { const u = users[i]?.username || users[i]?.name || ''; lines.push(`Sample task ${i + 1},${w.workCode},${w.workTitle},${u},medium,${fmtDate(7 + i * 3)},`); });
  } else {
    lines.push(`Sample task 1,,,use.real.username,medium,${fmtDate(7)},Optional description`);
  }
  if (works.length > 0) { lines.push('', '# Valid workCode values:'); works.forEach(w => lines.push(`# ${w.workCode},${w.workTitle}`)); }
  if (users.length > 0) { lines.push('', '# Valid assignedTo values (username or full name):'); users.forEach(u => lines.push(`# ${u.username || u.name}`)); }
  await downloadCSV(lines.join('\n'), 'work_allocation_bulk_upload_template.csv', 'Work Allocation Template');
}

const WorkAllocationPage: React.FC = () => {
  const { user, hasPermission, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const canView = user?.role === 'staff' ? hasPermission('work_orders', 'view') : true;
  const canCreate = user?.role === 'staff' ? hasPermission('work_orders', 'create') : true;

  // Redirect if no view permission (but only after auth is loaded)
  React.useEffect(() => {
    if (!authLoading && !canView) {
      navigate('/dashboard');
    }
  }, [canView, authLoading, navigate]);
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
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
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

  // Bulk upload state
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkUploadRow[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  // View Details Dialog State
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<any>(null);

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

      if (allocationsRes.success) {
        const sortedData = (allocationsRes.data || []).sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          return (b.id || 0) - (a.id || 0);
        });
        setAllocations(sortedData);
      }
      if (usersRes.success) setUsers((usersRes.data || []).filter((u: any) => u.isActive !== false).map((u: any) => ({ ...u, name: u.fullName || u.username || 'Unknown' })));
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

  // Close employee dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(e.target as Node)) {
        setEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredAllocations = allocations.filter((allocation) => {
    if (!allocation) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const assigneeName = users.find((u: any) => u.id === allocation.assignedTo)?.name?.toLowerCase() || '';

    // Status matching: only match if query is a prefix of a status word (not substring of title)
    const statusValue = (allocation.status?.toLowerCase() || '');
    const statusMatchTerms: Record<string, string[]> = {
      'pending': ['pending', 'pend'],
      'in-progress': ['in-progress', 'in progress', 'inprogress', 'progress'],
      'completed': ['completed', 'complete', 'done'],
    };
    const matchesStatusSearch = Object.entries(statusMatchTerms).some(([status, terms]) =>
      allocation.status === status && terms.some(t => t.startsWith(q) || q === t)
    );

    const matchesSearch =
      (allocation.title?.toLowerCase() || '').includes(q) ||
      (allocation.description?.toLowerCase() || '').includes(q) ||
      (allocation.priority?.toLowerCase() || '').startsWith(q) ||
      assigneeName.includes(q) ||
      (allocation.workTitle?.toLowerCase() || '').includes(q) ||
      (allocation.clientName?.toLowerCase() || '').includes(q) ||
      matchesStatusSearch;

    const matchesStatus = filterStatus === 'all' || allocation.status === filterStatus;
    const matchesEmployee = filterEmployee === 'all' || String(allocation.assignedTo) === filterEmployee;
    const dueDate = allocation.dueDate ? new Date(allocation.dueDate) : null;
    const matchesFrom = !filterDateFrom || (dueDate && dueDate >= new Date(filterDateFrom));
    const matchesTo = !filterDateTo || (dueDate && dueDate <= new Date(filterDateTo + 'T23:59:59'));
    return matchesSearch && matchesStatus && matchesEmployee && matchesFrom && matchesTo;
  }).sort((a: any, b: any) => (b.id || 0) - (a.id || 0));

  const hasActiveFilters = filterEmployee !== 'all' || filterDateFrom !== '' || filterDateTo !== '' || filterStatus !== 'all' || searchQuery !== '';

  const clearFilters = () => {
    setFilterEmployee('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterStatus('all');
    setSearchQuery('');
  };

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
      const response = await api.allocations.reassign(allocationToReassign.id, parseInt(reassignTargetId), reassignReason);
      if (response.success) {
        setAllocations((prev) => prev.map(a => a.id === allocationToReassign.id ? { ...a, assignedTo: parseInt(reassignTargetId), reassignedFrom: a.assignedTo } : a));
        toast.success("Task reassigned successfully");
        setIsReassignDialogOpen(false);
        setAllocationToReassign(null);
        setReassignTargetId('');
        setReassignReason('');
      } else {
        toast.error(response.message || "Failed to reassign");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openReassignDialog = (allocation: any) => {
    setAllocationToReassign(allocation);
    setReassignTargetId('');
    setReassignReason('');
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

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      toast.error('Unsupported file type. Please upload a CSV or Excel file.');
      return;
    }
    setBulkFile(file);
    setBulkResult(null);
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = ev => setBulkRows(parseBulkCSV(ev.target?.result as string));
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = ev => setBulkRows(parseBulkExcel(ev.target?.result as ArrayBuffer));
      reader.readAsArrayBuffer(file);
    }
  };

  const handleBulkUpload = async () => {
    if (bulkRows.length === 0) { toast.error('No rows to upload'); return; }
    setIsBulkUploading(true);
    setBulkResult(null);
    try {
      const res = await api.allocations.bulkCreate(bulkRows);
      // Handle both { success, data: { created, failed, errors } } and direct shapes
      const payload = res?.data ?? res;
      const isSuccess = res?.success ?? true;

      if (isSuccess) {
        const result: BulkResult = {
          created: payload?.created ?? 0,
          failed: payload?.failed ?? 0,
          errors: payload?.errors ?? [],
        };
        setBulkResult(result);
        if (result.created > 0) {
          fetchData();
          toast.success(`${result.created} allocation${result.created !== 1 ? 's' : ''} created`);
        } else {
          toast.error('No allocations were created. Check the errors below.');
        }
      } else {
        const errMsg = res?.message || 'Upload failed';
        setBulkResult({ created: 0, failed: bulkRows.length, errors: [errMsg] });
        toast.error(errMsg);
      }
    } catch (e: any) {
      const serverData = e?.response?.data;
      const msg = serverData?.message || e?.message || 'Upload failed';
      // If the server returned a partial result even in error, use it
      if (serverData?.data?.created !== undefined || serverData?.data?.failed !== undefined) {
        setBulkResult({
          created: serverData.data.created ?? 0,
          failed: serverData.data.failed ?? bulkRows.length,
          errors: serverData.data.errors ?? [msg],
        });
      } else {
        const serverErrors: string[] = serverData?.errors ?? [];
        setBulkResult({
          created: 0,
          failed: bulkRows.length,
          errors: serverErrors.length > 0 ? serverErrors : [msg],
        });
      }
      toast.error(msg);
    } finally {
      setIsBulkUploading(false);
    }
  };

  const handleBulkClose = () => {
    setIsBulkOpen(false);
    setBulkFile(null);
    setBulkRows([]);
    setBulkResult(null);
    if (bulkFileRef.current) bulkFileRef.current.value = '';
  };

  const pendingCount = allocations.filter((a) => a && a.status === 'pending').length;
  const inProgressCount = allocations.filter((a) => a && a.status === 'in-progress').length;
  const completedCount = allocations.filter((a) => a && a.status === 'completed').length;

  const getUserName = (userId: number, allocation?: any) => {
    // Prefer the pre-resolved name already returned by the backend
    if (allocation?.clientName) return allocation.clientName;
    return users.find((u) => u.id === userId)?.name || users.find((u) => u.id === userId)?.fullName || 'Unknown';
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'completed') return false;
    return new Date(dueDate) < new Date();
  };

  const CreateAllocationDialog = (
    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
      <DialogTrigger asChild>
        {/* Trigger for Desktop Header */}
        <Button className="hidden lg:flex gap-2 shadow-lg shadow-primary/20" onClick={(e) => {
          if (!canCreate) { e.preventDefault(); toast.error("You don't have permission to allocate work"); }
        }}>
          <Plus className="h-4 w-4" />
          Allocate New Work
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col rounded-[2rem] sm:rounded-lg">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Allocate Work</DialogTitle>
          <DialogDescription>
            Create a new work assignment for an employee.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0 no-scrollbar">
          <div className="space-y-2">
            <Label htmlFor="workId">Work Category *</Label>
            <Select
              value={newAllocation.workId}
              onValueChange={(value) => {
                const work = availableWorks.find(w => w.id.toString() === value);
                setNewAllocation((prev) => ({
                  ...prev,
                  workId: value,
                  title: work?.workTitle || ''
                }));
              }}
            >
              <SelectTrigger className="w-full rounded-xl bg-background">
                <SelectValue placeholder="Select Work Category" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" avoidCollisions={false} className="bg-card z-[200] max-h-[300px] overflow-y-auto">
                {availableWorks.map((work) => (
                  <SelectItem key={work.id} value={work.id.toString()}>
                    <div className="flex flex-col">
                      <span className="font-semibold">{work.workTitle}</span>
                      {work.workType && (
                        <span className="text-[9px] text-muted-foreground italic">{work.workType}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                      'flex items-center justify-center gap-2 rounded-xl border-2 py-2 text-sm font-semibold transition-all',
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
                <div className="space-y-2">
                  <Label htmlFor="property-select" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLocationType === 'tower' ? 'Select Tower' : 'Select Area'}
                  </Label>
                  <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                    <SelectTrigger id="property-select" className="w-full rounded-xl bg-background">
                      <SelectValue placeholder={selectedLocationType === 'tower' ? 'Choose a tower...' : 'Choose an area...'} />
                    </SelectTrigger>
                    <SelectContent position="popper" side="bottom" avoidCollisions={false} className="bg-card z-[200] max-h-[200px] overflow-y-auto">
                      {properties
                        .filter(p => selectedLocationType === 'tower'
                          ? p.propertyType !== 'others'
                          : p.propertyType === 'others')
                        .map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            <div className="flex items-center gap-2">
                              <span>{p.propertyName}</span>
                              {p.floorNo && <span className="text-xs opacity-70">{p.floorNo} Floors</span>}
                            </div>
                          </SelectItem>
                        ))}
                      {properties.filter(p => selectedLocationType === 'tower'
                        ? p.propertyType !== 'others'
                        : p.propertyType === 'others').length === 0 && (
                        <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                          No {selectedLocationType === 'tower' ? 'towers' : 'areas'} found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
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
              className="rounded-xl"
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
                    className="w-full justify-between h-auto min-h-10 py-2 rounded-xl"
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
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Search employees..." />
                    <CommandList 
                      style={{ maxHeight: '192px', overflowY: 'auto' }}
                      onWheel={(e) => {
                        e.stopPropagation();
                        const target = e.currentTarget;
                        target.scrollTop += e.deltaY;
                      }}
                    >
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        {users
                          .filter(user => {
                            const searchValue = (document.querySelector('[cmdk-input]') as HTMLInputElement)?.value?.toLowerCase() || '';
                            if (!searchValue) return true;
                            return user.name.toLowerCase().includes(searchValue);
                          })
                          .map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.id.toString()}
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
                            className="cursor-pointer"
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
                className="rounded-xl"
              />
            </div>
          </div>
          {newAllocation.assignedToIds.length > 0 && (
            <div className="space-y-3 p-3 bg-muted/30 rounded-xl border border-dashed animate-in slide-in-from-top-2 duration-300">
              <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <User className="h-3 w-3" />
                Individual Instructions (Optional)
              </Label>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                {newAllocation.assignedToIds.map(userId => (
                  <div key={userId} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{users.find(u => u.id === userId)?.name}</span>
                    </div>
                    <Textarea
                      placeholder={`Instructions for ${users.find(u => u.id === userId)?.name}...`}
                      className="text-xs min-h-[60px] resize-none rounded-lg"
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
              <SelectTrigger className="rounded-xl bg-background">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" avoidCollisions={false} className="bg-card z-[200]">
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Attachment <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <div
              className="border-2 border-dashed rounded-xl p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
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
                  <span className="text-xs text-primary font-bold">+ Add more</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-shrink-0 pt-2 border-t mt-4">
          <Button variant="outline" className="rounded-xl" onClick={() => setIsCreateDialogOpen(false)} disabled={isAllocating}>
            Cancel
          </Button>
          <Button className="rounded-xl" onClick={handleCreateAllocation} disabled={isAllocating}>
            {isAllocating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Allocating...</> : 'Allocate Work'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const renderBulkUploadDialog = () => (
    <Dialog open={isBulkOpen} onOpenChange={open => { if (!open) handleBulkClose(); else setIsBulkOpen(true); }}>
      <DialogContent className="bg-card sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Bulk Upload Work Allocations
          </DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file to create multiple allocations at once.
          </DialogDescription>
        </DialogHeader>

        {!bulkResult ? (
          <div className="space-y-4 py-2">
            {/* Template download */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">Download Template</p>
                <p className="text-xs text-slate-500">Excel file with allocation details</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => downloadBulkExcelTemplate(availableWorks, users)}>
                <Download className="h-3.5 w-3.5" /> Excel
              </Button>
            </div>

            {/* File upload area */}
            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              onClick={() => bulkFileRef.current?.click()}
            >
              <input
                ref={bulkFileRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handleBulkFileChange}
              />
              <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-semibold text-slate-600">
                {bulkFile ? bulkFile.name : 'Click to upload Excel or CSV file'}
              </p>
              <p className="text-xs text-slate-400 mt-1">or paste CSV data below</p>
            </div>

            {/* Manual CSV paste */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Or paste CSV data</Label>
              <textarea
                className="w-full h-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="title,workCode,workTitle,assignedTo,priority,dueDate,description"
                value={bulkFile ? '' : ''}
                onChange={(e) => {
                  const text = e.target.value;
                  if (text.trim()) {
                    const rows = parseBulkCSV(text);
                    setBulkRows(rows);
                    setBulkFile(null);
                  } else {
                    setBulkRows([]);
                  }
                }}
              />
            </div>

            {bulkRows.length > 0 && (
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-primary">{bulkRows.length}</span> row{bulkRows.length !== 1 ? 's' : ''} ready to upload
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {bulkResult.created > 0 && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-semibold text-emerald-700">{bulkResult.created} allocation{bulkResult.created === 1 ? '' : 's'} created successfully</p>
              </div>
            )}
            {bulkResult.errors.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">{bulkResult.errors.length} error{bulkResult.errors.length !== 1 ? 's' : ''}:</p>
                </div>
                {bulkResult.errors.map((e, i) => <p key={i} className="text-xs text-amber-600 pl-6">{e}</p>)}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleBulkClose}>Close</Button>
          {!bulkResult && (
            <Button
              onClick={handleBulkUpload}
              disabled={bulkRows.length === 0 || isBulkUploading}
              className="gap-2"
            >
              {isBulkUploading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload {bulkRows.length > 0 ? `${bulkRows.length} Row${bulkRows.length !== 1 ? 's' : ''}` : 'Allocations'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <DashboardLayout>
      <div className="w-full">
        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden lg:block space-y-6 animate-in fade-in duration-500 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Work Allocation</h1>
              <p className="text-muted-foreground">Assign and monitor work for your team</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="hidden lg:flex gap-2" onClick={() => setIsBulkOpen(true)}>
                <Upload className="h-4 w-4" />
                Bulk Upload
              </Button>
              {CreateAllocationDialog}
            </div>
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

          <Card className="border-none shadow-xl border-t-4 border-t-primary overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Title */}
                <CardTitle className="shrink-0">
                  Allocation Records
                  {hasActiveFilters && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({filteredAllocations.length} of {allocations.length})
                    </span>
                  )}
                </CardTitle>

                {/* Filters — inline */}
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Employee dropdown */}
                  {/* Employee dropdown — custom, always opens downward */}
                  {(() => {
                    const selectedUser = filterEmployee === 'all' ? null : users.find((u: any) => String(u.id) === filterEmployee);
                    return (
                      <div className="relative" ref={employeeDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setEmployeeDropdownOpen(v => !v)}
                          className="flex items-center gap-1.5 h-8 pl-2.5 pr-2 text-xs rounded-md border border-input bg-background text-foreground w-40 hover:bg-accent transition-colors"
                        >
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-left truncate">{selectedUser ? selectedUser.name : 'All Employees'}</span>
                          <svg className="h-3.5 w-3.5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {employeeDropdownOpen && (
                          <div className="absolute left-0 top-full mt-1 z-[200] w-48 rounded-md border bg-white dark:bg-card shadow-lg">
                            {/* Search input */}
                            <div className="p-2 border-b">
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Search employee..."
                                  value={employeeSearch}
                                  onChange={e => setEmployeeSearch(e.target.value)}
                                  className="w-full pl-7 pr-2 py-1 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                              </div>
                            </div>
                            {/* Options */}
                            <div className="max-h-48 overflow-y-auto">
                              {[{ id: 'all', name: 'All Employees' }, ...users]
                                .filter((u: any) => u.name.toLowerCase().includes(employeeSearch.toLowerCase()))
                                .map((u: any) => (
                                  <button
                                    key={u.id}
                                    type="button"
                                    className={cn(
                                      'w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors',
                                      String(u.id) === filterEmployee && 'bg-primary/10 text-primary font-semibold'
                                    )}
                                    onClick={() => { setFilterEmployee(String(u.id)); setEmployeeDropdownOpen(false); setEmployeeSearch(''); }}
                                  >
                                    {u.name}
                                  </button>
                                ))}
                              {[{ id: 'all', name: 'All Employees' }, ...users].filter((u: any) => u.name.toLowerCase().includes(employeeSearch.toLowerCase())).length === 0 && (
                                <p className="px-3 py-2 text-xs text-muted-foreground">No employees found</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Date from */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground shrink-0">From</span>
                    <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-8 w-34 text-xs" />
                  </div>

                  {/* Date to */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground shrink-0">To</span>
                    <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-8 w-34 text-xs" />
                  </div>

                  {/* Clear */}
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive gap-1" onClick={clearFilters}>
                      <X className="h-3.5 w-3.5" /> Clear
                    </Button>
                  )}
                </div>

                {/* Search — pushed to end */}
                <div className="relative w-full sm:w-56 sm:ml-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search allocations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-muted/50 focus:bg-background h-8 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="rounded-md border border-slate-200 m-6 mt-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="min-w-[1000px]">
                      <div className="sticky top-0 z-20 border-b bg-slate-50/50">
                        <Table className="border-x table-fixed w-full">
                          <colgroup>
                            <col style={{ width: '56px' }} />
                            <col style={{ width: '16%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '13%' }} />
                            <col style={{ width: '13%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '160px' }} />
                          </colgroup>
                          <TableHeader className="bg-primary hover:bg-primary">
                            <TableRow className="hover:bg-transparent border-none">
                              <TableHead className="text-white font-semibold h-11 text-center">S/No</TableHead>
                              <TableHead className="text-white font-semibold h-11">Work Identity</TableHead>
                              <TableHead className="text-white font-semibold h-11">Instructions</TableHead>
                              <TableHead className="text-white font-semibold h-11">Assigned To</TableHead>
                              <TableHead className="text-white font-semibold h-11">Status & Due</TableHead>
                              <TableHead className="text-white font-semibold h-11 text-center">Priority</TableHead>
                              <TableHead className="text-center text-white font-semibold px-4 h-11">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                        </Table>
                      </div>
                      <div className="overflow-y-auto" style={{ maxHeight: '392px' }}>
                      <Table className="border-x table-fixed w-full">
                        <colgroup>
                          <col style={{ width: '56px' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '13%' }} />
                          <col style={{ width: '13%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '160px' }} />
                        </colgroup>
                        <TableBody>
                          {filteredAllocations.map((allocation, index) => (
                            <TableRow key={allocation.id} className={cn("transition-colors group hover:bg-slate-50/50", allocation.requestStatus === 'pending' && "bg-amber-50/50")}>
                              <TableCell className="align-top border-r border-slate-200 text-center text-slate-500 text-sm font-medium">{index + 1}</TableCell>
                              <TableCell className="align-top border-r border-slate-200">
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
                                    } catch { /* not JSON */ }
                                    if (files.length === 0) return null;
                                    return (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {files.map((f, i) => {
                                          const isImage = f.Type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.Name);
                                          const fileExt = f.Name.split('.').pop()?.toUpperCase() || 'FILE';
                                          return isImage ? (
                                            <button key={i} type="button" onClick={() => setPreviewImage({ src: f.Data, name: f.Name })} title={f.Name}>
                                              <img src={f.Data} alt={f.Name} className="h-8 w-8 rounded object-cover border hover:opacity-80 cursor-zoom-in" />
                                            </button>
                                          ) : (
                                            <a key={i} href={f.Data} download={f.Name} title={f.Name}
                                              className="text-[10px] bg-slate-100 hover:bg-slate-200 rounded px-2 py-1 text-slate-600 flex items-center gap-1 border">
                                              <span className="font-bold text-primary">{fileExt}</span>
                                              <span className="truncate max-w-[80px]">{f.Name}</span>
                                            </a>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell className="align-top border-r border-slate-200">
                                {allocation.description ? (
                                  <div className="text-xs text-muted-foreground italic line-clamp-3">
                                    {allocation.description}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground/50 italic">No instruction given</span>
                                )}
                                {allocation.progressNote && allocation.status === 'in-progress' && (
                                  <div className="mt-1.5 flex items-start gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wide shrink-0 mt-0.5">Live</span>
                                    <span className="text-[11px] text-blue-800 italic leading-tight">{allocation.progressNote}</span>
                                  </div>
                                )}
                                {allocation.requestStatus === 'pending' && (
                                  <div className="mt-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[10px] space-y-1.5">
                                    <p className="font-bold text-amber-800 flex items-center gap-1">⚠️ Update Request</p>
                                    {allocation.requestedDueDate && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-amber-700 font-semibold shrink-0">New Due Date:</span>
                                        <span className="text-amber-900 font-bold">{format(new Date(allocation.requestedDueDate), 'MMM dd, yyyy')}</span>
                                      </div>
                                    )}
                                    {allocation.requestedDescription && (
                                      <div>
                                        <span className="text-amber-700 font-semibold">Note:</span>
                                        <p className="text-amber-900 mt-0.5 italic leading-snug">{allocation.requestedDescription}</p>
                                      </div>
                                    )}
                                    <div className="flex gap-2 pt-1">
                                      <Button size="sm" className="h-6 text-[9px] px-2.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApproveRequest(allocation.id)}>Approve</Button>
                                      <Button size="sm" variant="destructive" className="h-6 text-[9px] px-2.5" onClick={() => handleDenyRequest(allocation.id)}>Deny</Button>
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="align-top border-r border-slate-200">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                    {getUserName(allocation.assignedTo, allocation).charAt(0)}
                                  </div>
                                  <span className="font-medium text-sm">{getUserName(allocation.assignedTo, allocation)}</span>
                                </div>
                                <Button
                                  variant="link"
                                  className="h-auto p-0 text-[10px] text-muted-foreground hover:text-primary mt-1"
                                  onClick={() => openReassignDialog(allocation)}
                                >
                                  Reassign
                                </Button>
                              </TableCell>
                              <TableCell className="align-top border-r border-slate-200">
                                <div className="flex flex-col gap-1.5">
                                  <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold w-fit border", statusColors[allocation.status])}>
                                    {statusIcons[allocation.status]}
                                    <span className="capitalize">{allocation.status.replace('-', ' ')}</span>
                                  </div>
                                  <span className={cn("text-xs font-semibold", isOverdue(allocation.dueDate, allocation.status) ? 'text-destructive' : 'text-slate-600')}>
                                    Due: {format(new Date(allocation.dueDate), 'MMM dd')}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center align-top border-r border-slate-200">
                                <Badge variant="outline" className={cn("px-2 py-0 h-5 font-bold uppercase text-[10px]", priorityColors[allocation.priority])}>
                                  {allocation.priority}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-middle px-2">
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700 gap-1"
                                    onClick={() => { setSelectedAllocation(allocation); setIsViewDialogOpen(true); }}
                                  >
                                    <Eye className="h-3.5 w-3.5" /> View
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 hover:text-amber-700 gap-1"
                                    onClick={() => openReassignDialog(allocation)}
                                  >
                                    <UserX className="h-3.5 w-3.5" /> Reassign
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 gap-1"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Allocation?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently remove this assigned work for {getUserName(allocation.assignedTo, allocation)}. This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteAllocation(allocation.id)} className="bg-destructive hover:bg-destructive/90">
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
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div> {/* END DESKTOP VIEW */}

        {/* ===== MOBILE VIEW ===== */}
        <div className="block lg:hidden min-h-screen bg-slate-50 dark:bg-slate-950 pb-[80px] -mx-4 -mt-4">
          {/* Mobile Header */}
          <div className="bg-primary/95 pt-4 pb-10 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Work Allocation</h1>
                <p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Assign & Monitor Tasks</p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  onClick={() => setIsBulkOpen(true)}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-full h-[46px] w-[46px] shadow-sm backdrop-blur-md p-0 flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer"
                  title="Bulk Upload"
                >
                  <Upload className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div onClick={(e) => {
                  if (!canCreate) { e.preventDefault(); toast.error("You don't have permission to allocate work"); }
                  else { setIsCreateDialogOpen(true); }
                }} className="bg-white/10 hover:bg-white/20 text-white rounded-full h-[46px] w-[46px] shadow-sm backdrop-blur-md p-0 flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer">
                  <Plus className="h-6 w-6" strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Summary - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3 px-5 -mt-8 relative z-20 pb-2">
            {[
              { label: 'Total', count: allocations.length, color: 'text-primary', dot: 'bg-primary/40', status: 'all' },
              { label: 'Pending', count: pendingCount, color: 'text-amber-500', dot: 'bg-amber-400', status: 'pending' },
              { label: 'Active', count: inProgressCount, color: 'text-blue-500', dot: 'bg-blue-400', status: 'in-progress' },
              { label: 'Done', count: completedCount, color: 'text-emerald-500', dot: 'bg-emerald-400', status: 'completed' },
            ].map((stat) => (
              <div
                key={stat.label}
                onClick={() => setFilterStatus(stat.status as any)}
                className={cn(
                  "bg-white dark:bg-card rounded-3xl p-4 shadow-lg ring-1 cursor-pointer active:scale-[0.97] transition-all",
                  filterStatus === stat.status ? "ring-2 ring-primary" : "ring-black/5"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("text-[9px] font-black uppercase tracking-widest", stat.color)}>{stat.label}</span>
                  <span className={cn("h-2 w-2 rounded-full", stat.dot)} />
                </div>
                <p className="text-4xl font-black tracking-tighter text-slate-800 dark:text-slate-100 leading-none">
                  {isLoading ? '—' : stat.count}
                </p>
              </div>
            ))}
          </div>

          {/* Mobile Search & List */}
          <div className="px-5 space-y-6 mt-6">
            <div className="relative shadow-sm shadow-black/5 rounded-[1.5rem]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder="Search allocations..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="pl-12 h-14 rounded-[1.5rem] bg-white dark:bg-slate-900 border-none ring-1 ring-slate-100 dark:ring-slate-800 text-sm font-bold shadow-none focus-visible:ring-primary" 
              />
            </div>

            {/* Mobile Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {['all', 'pending', 'in-progress', 'completed'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilterStatus(tab as any)}
                  className={cn(
                    "shrink-0 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all active:scale-95",
                    filterStatus === tab
                      ? "bg-slate-800 text-white shadow-md"
                      : "bg-white dark:bg-slate-800 text-slate-500 ring-1 ring-slate-100 dark:ring-slate-700"
                  )}
                >
                  {tab === 'all' ? 'All' : tab.replace('-', ' ')}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              </div>
            ) : filteredAllocations.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-white dark:bg-card rounded-[2.5rem] shadow-sm ring-1 ring-slate-100">
                <div className="h-20 w-20 mb-4 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <ClipboardList className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-base font-black text-slate-500 tracking-tight">No allocations found</p>
              </div>
            ) : (
              <div className="space-y-4 pb-12">
                {filteredAllocations.map((allocation) => (
                  <div 
                    key={allocation.id} 
                    className={cn(
                      "bg-white dark:bg-card rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5 flex flex-col gap-4 relative overflow-hidden transition-all active:scale-[0.99]",
                      allocation.requestStatus === 'pending' && "ring-2 ring-amber-400/50 bg-amber-50/10"
                    )}
                  >
                    {allocation.requestStatus === 'pending' && (
                      <div className="absolute top-0 right-0 bg-amber-400 text-[8px] font-black uppercase px-3 py-1 rounded-bl-xl text-white tracking-widest">
                        Update Request
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="outline" className={cn("text-[8px] px-2 py-0.5 font-black uppercase tracking-widest border-0", priorityColors[allocation.priority])}>
                            {allocation.priority}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">#{allocation.id}</span>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight tracking-tight">
                          {allocation.title}
                        </h3>
                        {allocation.workTitle && (
                          <p className="text-[10px] font-bold text-primary mt-1 flex items-center gap-1 opacity-80">
                            <Building2 className="h-3 w-3" /> {allocation.workTitle}
                          </p>
                        )}
                      </div>
                      
                      <div className={cn(
                        "h-12 w-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border shadow-sm",
                        isOverdue(allocation.dueDate, allocation.status) ? "bg-rose-50 border-rose-100 text-rose-500" : "bg-slate-50 border-slate-100 text-slate-600"
                      )}>
                        <span className="text-[8px] font-black uppercase opacity-60 leading-none mb-0.5">Due</span>
                        <span className="text-xs font-black leading-none">{format(new Date(allocation.dueDate), 'dd')}</span>
                        <span className="text-[8px] font-black uppercase leading-none mt-0.5">{format(new Date(allocation.dueDate), 'MMM')}</span>
                      </div>
                    </div>

                    {allocation.description && (
                      <div className="bg-slate-50/80 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed italic">
                          "{allocation.description}"
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 ring-1 ring-slate-100 dark:ring-slate-700 pr-3 pl-1 py-1 rounded-full shadow-sm">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black border border-primary/20">
                          {getUserName(allocation.assignedTo, allocation).charAt(0)}
                        </div>
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{getUserName(allocation.assignedTo, allocation)}</span>
                      </div>

                      <div className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm",
                        statusColors[allocation.status]
                      )}>
                        {statusIcons[allocation.status]}
                        {allocation.status.replace('-', ' ')}
                      </div>
                    </div>

                    {/* Progress Note & Attachments logic same as before... */}
                    {allocation.progressNote && allocation.status === 'in-progress' && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 line-clamp-1">{allocation.progressNote}</p>
                      </div>
                    )}

                    {allocation.attachmentUrls && (() => {
                      let files: { Name: string; Type: string; Data: string }[] = [];
                      try {
                        const parsed = JSON.parse(allocation.attachmentUrls);
                        if (Array.isArray(parsed)) files = parsed;
                      } catch { /* not JSON */ }
                      if (files.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {files.map((f, i) => {
                            const isImage = f.Type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.Name);
                            const fileExt = f.Name.split('.').pop()?.toUpperCase() || 'FILE';
                            return isImage ? (
                              <button key={i} type="button" onClick={() => setPreviewImage({ src: f.Data, name: f.Name })} className="relative h-12 w-12 rounded-xl overflow-hidden border ring-1 ring-black/5 active:scale-95 transition-transform">
                                <img src={f.Data} alt={f.Name} className="h-full w-full object-cover" />
                              </button>
                            ) : (
                              <a key={i} href={f.Data} download={f.Name} title={f.Name} className="h-12 flex items-center gap-2 px-3 rounded-xl bg-slate-50 border border-slate-100 active:scale-95 transition-transform">
                                <div className="flex flex-col items-center">
                                  <ClipboardList className="h-4 w-4 text-slate-400" />
                                  <span className="text-[8px] font-black text-primary">{fileExt}</span>
                                </div>
                                <span className="text-[9px] font-bold text-slate-600 max-w-[60px] truncate">{f.Name}</span>
                              </a>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Request Actions */}
                    {allocation.requestStatus === 'pending' && (
                      <div className="space-y-3 pt-2 border-t border-amber-100">
                        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                          <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1">⚠️ Update Request</p>
                          {allocation.requestedDueDate && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-amber-700 shrink-0">New Due Date:</span>
                              <span className="text-[11px] font-black text-amber-900">{format(new Date(allocation.requestedDueDate), 'MMM dd, yyyy')}</span>
                            </div>
                          )}
                          {allocation.requestedDescription && (
                            <div>
                              <span className="text-[10px] font-bold text-amber-700">Employee Note:</span>
                              <p className="text-[11px] text-amber-900 mt-0.5 italic leading-relaxed">{allocation.requestedDescription}</p>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            onClick={() => handleApproveRequest(allocation.id)}
                            className="h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-emerald-500/20"
                          >
                            ✅ Approve
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => handleDenyRequest(allocation.id)}
                            className="h-10 rounded-xl border-rose-100 text-rose-500 hover:bg-rose-50 text-[10px] font-black uppercase tracking-widest"
                          >
                            ❌ Decline
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <Button 
                        variant="outline" 
                        className="flex-1 h-11 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-800 text-white border-0 hover:bg-slate-900 shadow-lg shadow-slate-800/20 active:scale-95 transition-all"
                        onClick={() => openReassignDialog(allocation)}
                      >
                        <User className="h-3.5 w-3.5 mr-2" /> Reassign
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="h-11 w-11 rounded-2xl border-rose-100 text-rose-500 hover:bg-rose-50 active:scale-95 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[2rem] max-w-[90vw] sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-black text-xl tracking-tight">Delete Allocation?</AlertDialogTitle>
                            <AlertDialogDescription className="font-semibold text-slate-500">
                              This will permanently remove this task for {getUserName(allocation.assignedTo, allocation)}. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-row gap-2 mt-4">
                            <AlertDialogCancel className="flex-1 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteAllocation(allocation.id)}
                              className="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-500/20"
                            >
                              Confirm
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shared Modals */}
      
      {/* Shared Reassign Dialog */}
      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[2rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">Reassign Task</DialogTitle>
            <DialogDescription className="font-semibold text-muted-foreground">
              Move this work to another employee
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Select New Employee</Label>
              <div className="border rounded-2xl max-h-56 overflow-y-auto divide-y scrollbar-none">
                {users.filter(u => u.id !== allocationToReassign?.assignedTo).map((u: any) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setReassignTargetId(u.id.toString())}
                    className={cn(
                      "w-full text-left px-4 py-3 text-sm font-bold transition-all flex items-center justify-between",
                      reassignTargetId === u.id.toString() 
                        ? "bg-primary text-white" 
                        : "hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <span>{u.name}</span>
                    {reassignTargetId === u.id.toString() && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Reason for Reassignment</Label>
              <Textarea 
                placeholder="Optional: Enter reason..." 
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                className="rounded-xl border-slate-200 focus:ring-primary min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1 rounded-2xl font-black text-xs uppercase tracking-widest" onClick={() => setIsReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReassign} 
              disabled={!reassignTargetId}
              className="flex-1 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              Reassign Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shared Preview Image Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-xl hover:bg-slate-100 active:scale-95 transition-all"
            onClick={() => setPreviewImage(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex flex-col items-center gap-4">
            <img
              src={previewImage.src}
              alt={previewImage.name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white font-bold text-sm uppercase tracking-wider drop-shadow-md">
              {previewImage.name}
            </p>
          </div>
        </div>
      )}

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Work Allocation Details</DialogTitle>
            <DialogDescription>Complete information about this work assignment</DialogDescription>
          </DialogHeader>
          {selectedAllocation && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Work Title</Label>
                  <p className="font-semibold">{selectedAllocation.title}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Work Category</Label>
                  <Badge variant="outline" className="font-semibold">{selectedAllocation.workTitle}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Description</Label>
                <p className="text-sm text-muted-foreground">{selectedAllocation.description || 'No description provided'}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Assigned To</Label>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {getUserName(selectedAllocation.assignedTo, selectedAllocation).charAt(0)}
                    </div>
                    <span className="font-medium text-sm">{getUserName(selectedAllocation.assignedTo, selectedAllocation)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
                  <Badge className={cn("capitalize", statusColors[selectedAllocation.status])}>
                    {selectedAllocation.status.replace('-', ' ')}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Priority</Label>
                  <Badge variant="outline" className={cn("capitalize", priorityColors[selectedAllocation.priority])}>
                    {selectedAllocation.priority}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Due Date</Label>
                  <p className="text-sm font-semibold">{format(new Date(selectedAllocation.dueDate), 'MMM dd, yyyy')}</p>
                </div>
                {selectedAllocation.duration && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Time Spent</Label>
                    <p className="text-sm font-semibold">{selectedAllocation.duration}</p>
                  </div>
                )}
              </div>

              {selectedAllocation.progressNote && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Latest Progress Update</Label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900 italic">"{selectedAllocation.progressNote}"</p>
                  </div>
                </div>
              )}

              {selectedAllocation.attachmentUrls && (() => {
                let files: { Name: string; Type: string; Data: string }[] = [];
                try {
                  const parsed = JSON.parse(selectedAllocation.attachmentUrls);
                  if (Array.isArray(parsed)) files = parsed;
                } catch { }
                if (files.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Attachments ({files.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {files.map((f, i) => {
                        const isImage = f.Type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.Name);
                        const fileExt = f.Name.split('.').pop()?.toUpperCase() || 'FILE';
                        return isImage ? (
                          <button key={i} type="button" onClick={() => setPreviewImage({ src: f.Data, name: f.Name })}>
                            <img src={f.Data} alt={f.Name} className="h-20 w-20 rounded-lg object-cover border hover:opacity-80 cursor-zoom-in" />
                          </button>
                        ) : (
                          <a key={i} href={f.Data} download={f.Name} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg border">
                            <div className="flex flex-col items-center">
                              <ClipboardList className="h-5 w-5 text-slate-400" />
                              <span className="text-[8px] font-bold text-primary">{fileExt}</span>
                            </div>
                            <span className="text-xs font-medium text-slate-700 max-w-[150px] truncate">{f.Name}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      {renderBulkUploadDialog()}

      {/* Image Preview */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-3xl p-2">
            <img src={previewImage.src} alt={previewImage.name} className="w-full rounded-lg object-contain max-h-[80vh]" />
          </DialogContent>
        </Dialog>
      )}

    </DashboardLayout>
  );
};

export default WorkAllocationPage;