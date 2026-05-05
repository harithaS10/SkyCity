import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Building2,
  Home,
  Layers,
  MapPin,
  Plus,
  Search,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface PropertyItem {
  id: number;
  propertyName: string;
  propertyType: 'apartment' | 'others';
  towerName?: string;
  floorNo?: string;
  doorNo?: string;
  contactName?: string;
  contactMobile?: string;
  commonAreas?: string;
  address?: string;
}

interface AddPropertyForm {
  propertyType: 'apartment' | 'others';
  propertyName: string;
  towerName: string;
  floorNo: string;
  doorNo: string;
  contactName: string;
  contactMobile: string;
  commonAreas: string;
  address: string;
}

interface BulkRow {
  propertyType: string;
  towerName: string;
  floorNo: string;
  doorNo: string;
  contactName: string;
  contactMobile: string;
  areaName: string;
  info: string;
}

interface BulkResult {
  success: number;
  failed: number;
  errors: string[];
}

const COMMON_AREA_PRESETS = ['Swimming Pool', 'Club House', 'Gym', 'Parking', 'Garden', 'Terrace'];

const CSV_COLUMNS = 'propertyType,towerName,floorNo,doorNo,contactName,contactMobile,areaName,info';

const EMPTY_FORM: AddPropertyForm = {
  propertyType: 'apartment',
  propertyName: '',
  towerName: '',
  floorNo: '',
  doorNo: '',
  contactName: '',
  contactMobile: '',
  commonAreas: '',
  address: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Normalise a raw cell value to a clean string (handles scientific notation, numbers, etc.) */
function cellToString(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  // Convert scientific notation (e.g. 9.88E+09) back to full number string
  if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(s)) {
    try { return String(Math.round(Number(s))); } catch { return s; }
  }
  return s;
}

/** Map a raw row array (or object) to a BulkRow using positional or named columns */
function rowToBulkRow(row: unknown): BulkRow {
  if (Array.isArray(row)) {
    return {
      propertyType: cellToString(row[0]),
      towerName:    cellToString(row[1]),
      floorNo:      cellToString(row[2]),
      doorNo:       cellToString(row[3]),
      contactName:  cellToString(row[4]),
      contactMobile:cellToString(row[5]),
      areaName:     cellToString(row[6]),
      info:         cellToString(row[7]),
    };
  }
  // Object with named keys (xlsx header: 1 mode)
  const r = row as Record<string, unknown>;
  return {
    propertyType:  cellToString(r['propertyType']  ?? r['PropertyType']  ?? r['property_type']  ?? r['A'] ?? ''),
    towerName:     cellToString(r['towerName']     ?? r['TowerName']     ?? r['tower_name']     ?? r['B'] ?? ''),
    floorNo:       cellToString(r['floorNo']       ?? r['FloorNo']       ?? r['floor_no']       ?? r['C'] ?? ''),
    doorNo:        cellToString(r['doorNo']        ?? r['DoorNo']        ?? r['door_no']        ?? r['D'] ?? ''),
    contactName:   cellToString(r['contactName']   ?? r['ContactName']   ?? r['contact_name']   ?? r['E'] ?? ''),
    contactMobile: cellToString(r['contactMobile'] ?? r['ContactMobile'] ?? r['contact_mobile'] ?? r['F'] ?? ''),
    areaName:      cellToString(r['areaName']      ?? r['AreaName']      ?? r['area_name']      ?? r['G'] ?? ''),
    info:          cellToString(r['info']          ?? r['Info']          ?? r['H'] ?? ''),
  };
}

function parseCSV(text: string): BulkRow[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return [];
  const firstLine = lines[0].trim().toLowerCase();
  const startIdx = firstLine.startsWith('propertytype') ? 1 : 0;
  return lines.slice(startIdx).map((line) => {
    const cols = line.split(',').map(cellToString);
    return rowToBulkRow(cols);
  });
}

/** Parse an Excel file (ArrayBuffer) and return BulkRow[] */
function parseExcel(buffer: ArrayBuffer): BulkRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  // Use header:1 to get raw arrays; first row is headers
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length === 0) return [];

  // Detect if first row is a header row
  const firstRow = rows[0].map((c) => cellToString(c).toLowerCase());
  const isHeader = firstRow.some((c) => c === 'propertytype' || c === 'towername' || c === 'areaname');
  const dataRows = isHeader ? rows.slice(1) : rows;

  return dataRows
    .filter((row) => row.some((c) => cellToString(c) !== '')) // skip blank rows
    .map(rowToBulkRow);
}

function downloadExcelTemplate() {
  const data = [
    ['propertyType', 'towerName', 'floorNo', 'doorNo', 'contactName', 'contactMobile', 'areaName', 'info'],
    ['Apartment', 'Tower A', '1', '101', 'John Doe', '9876543210', '', ''],
    ['Common Area', '', '', '', '', '', 'Swimming Pool', 'Main pool area'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  // Set column widths
  ws['!cols'] = [14, 12, 8, 8, 14, 16, 16, 20].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'property_bulk_upload');
  XLSX.writeFile(wb, 'property_bulk_upload_template.xlsx');
}

function downloadCSVTemplate() {
  const sample = [
    CSV_COLUMNS,
    'Apartment,Tower A,1,101,John Doe,9876543210,,',
    'Common Area,,,,,,Swimming Pool,Main pool area',
  ].join('\n');
  const blob = new Blob([sample], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'property_bulk_upload_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ──────────────────────────────────────────────────────────────

const PropertyManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [form, setForm] = useState<AddPropertyForm>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Bulk upload state
  const [bulkText, setBulkText] = useState('');
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Query ──────────────────────────────────────────────────────────────
  const { data: propertiesData, isLoading } = useQuery({
    queryKey: ['properties', user?.associationId],
    queryFn: () => api.properties.getByAssociation(Number(user?.associationId)),
    enabled: !!user?.associationId,
  });

  const rawProperties: PropertyItem[] = React.useMemo(() => {
    if (!propertiesData?.data) return [];
    const d = propertiesData.data as unknown as PropertyItem[] | { items: PropertyItem[] };
    if (Array.isArray(d)) return d;
    if ('items' in d && Array.isArray(d.items)) return d.items;
    return [];
  }, [propertiesData]);

  const properties = React.useMemo(() => {
    if (!search.trim()) return rawProperties;
    const q = search.toLowerCase();
    return rawProperties.filter(
      (p) =>
        p.propertyName?.toLowerCase().includes(q) ||
        p.towerName?.toLowerCase().includes(q) ||
        p.doorNo?.toLowerCase().includes(q) ||
        p.contactName?.toLowerCase().includes(q) ||
        p.commonAreas?.toLowerCase().includes(q)
    );
  }, [rawProperties, search]);

  // ── Stats ──────────────────────────────────────────────────────────────
  const totalProperties = rawProperties.length;
  const apartments = rawProperties.filter((p) => p.propertyType === 'apartment').length;
  const commonAreas = rawProperties.filter((p) => p.propertyType === 'others').length;

  // ── Mutations ──────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: Partial<PropertyItem>) => api.properties.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', user?.associationId] });
      toast.success('Property added successfully');
      setAddOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Failed to add property');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.properties.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', user?.associationId] });
      toast.success('Property deleted');
      setDeleteConfirmId(null);
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Failed to delete property');
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleAddSubmit = () => {
    if (!form.propertyName.trim()) {
      toast.error('Property name is required');
      return;
    }
    const payload: Partial<PropertyItem> & { associationId?: number } = {
      propertyType: form.propertyType,
      propertyName: form.propertyName.trim(),
      associationId: Number(user?.associationId),
    };
    if (form.propertyType === 'apartment') {
      if (form.towerName) payload.towerName = form.towerName.trim();
      if (form.floorNo) payload.floorNo = form.floorNo.trim();
      if (form.doorNo) payload.doorNo = form.doorNo.trim();
      if (form.contactName) payload.contactName = form.contactName.trim();
      if (form.contactMobile) payload.contactMobile = form.contactMobile.trim();
      if (form.address) payload.address = form.address.trim();
    } else {
      if (form.commonAreas) payload.commonAreas = form.commonAreas.trim().split(',').map((s: string) => s.trim()).filter(Boolean) as any;
      if (form.address) payload.address = form.address.trim();
    }
    createMutation.mutate(payload);
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const buffer = ev.target?.result as ArrayBuffer;
        const rows = parseExcel(buffer);
        setBulkText('');
        setBulkRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setBulkText(text);
        setBulkRows(parseCSV(text));
      };
      reader.readAsText(file);
    }
  };

  const handleBulkTextChange = (text: string) => {
    setBulkText(text);
    setBulkRows(parseCSV(text));
  };

  const handleBulkUpload = async () => {
    if (bulkRows.length === 0) {
      toast.error('No rows to upload');
      return;
    }
    setIsBulkUploading(true);
    setBulkResult(null);
    const errors: string[] = [];

    // Build the properties array for the bulk endpoint
    const properties: any[] = [];
    for (let i = 0; i < bulkRows.length; i++) {
      const row = bulkRows[i];
      const rowNum = i + 1;
      const isApartment = ['apartment'].includes(row.propertyType?.toLowerCase() ?? '');
      // For apartments: use towerName as property name; for others: use areaName
      const propertyName = isApartment
        ? (row.towerName || `Floor${row.floorNo}-Door${row.doorNo}`.replace(/Floor-Door/g, ''))
        : row.areaName;
      if (!propertyName) {
        errors.push(`Row ${rowNum}: Missing property name`);
        continue;
      }
      properties.push({
        propertyName,
        propertyType: isApartment ? 'apartment' : 'others',
        towerName: row.towerName || null,
        floorNo: row.floorNo || null,
        doorNo: row.doorNo || null,
        contactName: row.contactName || null,
        contactMobile: row.contactMobile || null,
        commonAreas: !isApartment ? (row.areaName ? [row.areaName] : []) : [],
        address: row.info || null,
        totalUnits: 0,
      });
    }

    if (properties.length === 0) {
      setIsBulkUploading(false);
      setBulkResult({ success: 0, failed: bulkRows.length, errors });
      return;
    }

    try {
      const res = await api.properties.bulkCreate({ properties });
      const created = res?.data?.Created ?? properties.length;
      setBulkResult({ success: created, failed: errors.length, errors });
      if (created > 0) {
        queryClient.invalidateQueries({ queryKey: ['properties', user?.associationId] });
        toast.success(`${created} propert${created === 1 ? 'y' : 'ies'} uploaded`);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Upload failed';
      errors.push(msg);
      setBulkResult({ success: 0, failed: properties.length, errors });
      toast.error(msg);
    } finally {
      setIsBulkUploading(false);
    }
  };

  const handleBulkClose = () => {
    setBulkOpen(false);
    setBulkText('');
    setBulkFile(null);
    setBulkRows([]);
    setBulkResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePresetToggle = (preset: string) => {
    const current = form.commonAreas
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const idx = current.indexOf(preset);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(preset);
    }
    setForm((f) => ({ ...f, commonAreas: current.join(', ') }));
  };

  const isPresetActive = (preset: string) =>
    form.commonAreas
      .split(',')
      .map((s) => s.trim())
      .includes(preset);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        {/* ===== DESKTOP HEADER & STATS ===== */}
        <div className="hidden sm:block space-y-6 mb-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Property Management</h1>
              <p className="text-muted-foreground">Manage apartments, towers, and common areas for your association</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setBulkOpen(true)}>
                <Upload className="h-4 w-4" />
                Bulk Upload
              </Button>
              <Button className="gap-2" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Property
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalProperties}</p>
                  <p className="text-sm text-muted-foreground">Total Properties</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100/50">
                  <Home className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{apartments}</p>
                  <p className="text-sm text-muted-foreground">Apartments</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100/50">
                  <Layers className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{commonAreas}</p>
                  <p className="text-sm text-muted-foreground">Common Areas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Desktop Table */}
          <Card className="overflow-hidden border-none shadow-md">
          <CardHeader className="bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" />
                All Properties
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search properties..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-lg bg-slate-50 mx-6 mb-6">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500 font-medium">No properties found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {search ? 'Try a different search term.' : 'Add your first property to get started.'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 m-6 mt-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table className="border-x table-fixed w-full">
                    <colgroup>
                      <col style={{ width: '52px' }} />
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '90px' }} />
                    </colgroup>
                    <TableHeader className="bg-primary hover:bg-primary">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-white font-semibold h-11 text-center">#</TableHead>
                        <TableHead className="text-white font-semibold h-11">Property Name</TableHead>
                        <TableHead className="text-white font-semibold h-11">Type</TableHead>
                        <TableHead className="text-white font-semibold h-11">Details</TableHead>
                        <TableHead className="text-white font-semibold h-11">Contact</TableHead>
                        <TableHead className="text-white font-semibold h-11 text-right px-4">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                  </Table>
                  <div className="overflow-y-auto" style={{ maxHeight: '392px' }}>
                    <Table className="border-x table-fixed w-full">
                      <colgroup>
                        <col style={{ width: '52px' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '90px' }} />
                      </colgroup>
                      <TableBody>
                        {properties.map((prop, i) => (
                          <TableRow key={prop.id} className="hover:bg-slate-50/50">
                            <TableCell className="border-r border-slate-200 text-center text-slate-500 text-sm font-medium">{i + 1}</TableCell>
                            <TableCell className="border-r border-slate-200 font-medium">{prop.propertyName}</TableCell>
                            <TableCell className="border-r border-slate-200">
                              {prop.propertyType === 'apartment' ? (
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-0">
                                  <Home className="h-3 w-3 mr-1" />
                                  Apartment
                                </Badge>
                              ) : (
                                <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100 border-0">
                                  <Layers className="h-3 w-3 mr-1" />
                                  Common Area
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="border-r border-slate-200">
                              <div className="text-sm space-y-0.5">
                                {prop.towerName && (
                                  <div className="text-slate-600"><span className="text-slate-400">Tower:</span> {prop.towerName}</div>
                                )}
                                {prop.floorNo && (
                                  <div className="text-slate-600"><span className="text-slate-400">Floor:</span> {prop.floorNo}</div>
                                )}
                                {prop.doorNo && (
                                  <div className="text-slate-600"><span className="text-slate-400">Door:</span> {prop.doorNo}</div>
                                )}
                                {prop.commonAreas && (
                                  <div className="text-slate-600"><span className="text-slate-400">Areas:</span> {prop.commonAreas}</div>
                                )}
                                {prop.address && (
                                  <div className="text-slate-500 flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {prop.address}
                                  </div>
                                )}
                                {!prop.towerName && !prop.floorNo && !prop.doorNo && !prop.commonAreas && !prop.address && (
                                  <span className="text-slate-400">—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="border-r border-slate-200">
                              {prop.contactName || prop.contactMobile ? (
                                <div className="text-sm">
                                  {prop.contactName && <div className="font-medium text-slate-700">{prop.contactName}</div>}
                                  {prop.contactMobile && <div className="text-slate-500">{prop.contactMobile}</div>}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteConfirmId(prop.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="block sm:hidden bg-slate-50 -mx-4 -mt-4 min-h-[calc(100vh-5rem)]">
          <div className="bg-primary pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black text-white tracking-tight truncate">Property Management</h1>
                <p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Manage apartments, towers, and common areas</p>
              </div>
              <Button variant="ghost" className="bg-white/10 text-white rounded-2xl h-11 w-11 p-0 shrink-0 backdrop-blur-md border-0" onClick={() => setAddOpen(true)}>
                <Plus className="h-5 w-5" />
              </Button>
              <Button variant="ghost" className="bg-white/10 text-white rounded-2xl h-11 w-11 p-0 shrink-0 backdrop-blur-md border-0" onClick={() => setBulkOpen(true)}>
                <Upload className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <Building2 className="h-4 w-4 text-white mb-1 opacity-80" />
                <p className="text-xl font-black">{totalProperties}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Total</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <Home className="h-4 w-4 text-emerald-300 mb-1 opacity-80" />
                <p className="text-xl font-black">{apartments}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Apartments</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <Layers className="h-4 w-4 text-violet-300 mb-1 opacity-80" />
                <p className="text-xl font-black">{commonAreas}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Areas</p>
              </div>
            </div>
          </div>

          <div className="px-5 -mt-6 relative z-20 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search properties..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 pl-12 pr-4 rounded-2xl bg-white border-none shadow-xl ring-1 ring-black/5 font-bold text-sm"
              />
            </div>

            <div className="space-y-3 pb-6">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : properties.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <Building2 className="h-12 w-12 mb-3 text-slate-300" />
                  <p className="text-sm font-bold text-slate-500">No properties found</p>
                </div>
              ) : (
                properties.map((prop) => {
                  const isApartment = prop.propertyType === 'apartment';
                  const bgColor = isApartment ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700';
                  
                  return (
                    <div key={prop.id} className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-black/5 flex flex-col gap-3">
                      <div className="flex items-start gap-4">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${bgColor}`}>
                          {isApartment ? <Home className="h-5 w-5" /> : <Layers className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-slate-800 truncate mb-0.5">{prop.propertyName}</h4>
                          <Badge className={`${bgColor} hover:${bgColor} border-0 text-[10px] px-2 py-0`}>
                            {isApartment ? 'Apartment' : 'Common Area'}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => setDeleteConfirmId(prop.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="text-xs text-slate-600 space-y-1 bg-slate-50 rounded-2xl p-3">
                        {prop.towerName && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold min-w-[60px]">Tower:</span>
                            <span className="font-medium">{prop.towerName}</span>
                          </div>
                        )}
                        {prop.floorNo && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold min-w-[60px]">Floor:</span>
                            <span className="font-medium">{prop.floorNo}</span>
                          </div>
                        )}
                        {prop.doorNo && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold min-w-[60px]">Door:</span>
                            <span className="font-medium">{prop.doorNo}</span>
                          </div>
                        )}
                        {prop.contactName && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold min-w-[60px]">Contact:</span>
                            <span className="font-medium">{prop.contactName}</span>
                          </div>
                        )}
                        {prop.contactMobile && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold min-w-[60px]">Mobile:</span>
                            <span className="font-medium">{prop.contactMobile}</span>
                          </div>
                        )}
                        {prop.commonAreas && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold min-w-[60px]">Areas:</span>
                            <span className="font-medium">{prop.commonAreas}</span>
                          </div>
                        )}
                        {prop.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                            <span className="font-medium text-slate-500">{prop.address}</span>
                          </div>
                        )}
                        {!prop.towerName && !prop.floorNo && !prop.doorNo && !prop.contactName && !prop.contactMobile && !prop.commonAreas && !prop.address && (
                          <span className="text-slate-400 italic">No additional details</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Mobile Card List - OLD (REMOVED) */}
        <div className="hidden space-y-3">
          {/* Old mobile cards removed - now using new mobile view above */}
        </div>
      </div>

      {/* ── Add Property Dialog ─────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setForm(EMPTY_FORM); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Property</DialogTitle>
            <DialogDescription>Fill in the details to add a new property.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type Toggle */}
            <div className="space-y-2">
              <Label>Property Type</Label>
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  className={cn(
                    'flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    form.propertyType === 'apartment'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  )}
                  onClick={() => setForm((f) => ({ ...f, propertyType: 'apartment', propertyName: '' }))}
                >
                  <Home className="h-4 w-4" />
                  Apartment
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 border-l',
                    form.propertyType === 'others'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  )}
                  onClick={() => setForm((f) => ({ ...f, propertyType: 'others', propertyName: '' }))}
                >
                  <Layers className="h-4 w-4" />
                  Common Area
                </button>
              </div>
            </div>

            {/* Property Name */}
            <div className="space-y-2">
              <Label htmlFor="propertyName">
                {form.propertyType === 'apartment' ? 'Apartment Name' : 'Area Name'} *
              </Label>
              <Input
                id="propertyName"
                placeholder={form.propertyType === 'apartment' ? 'e.g. A-101' : 'e.g. Swimming Pool'}
                value={form.propertyName}
                onChange={(e) => setForm((f) => ({ ...f, propertyName: e.target.value }))}
              />
            </div>

            {form.propertyType === 'apartment' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="towerName">Tower Name</Label>
                    <Input
                      id="towerName"
                      placeholder="e.g. Tower A"
                      value={form.towerName}
                      onChange={(e) => setForm((f) => ({ ...f, towerName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floorNo">Floor No.</Label>
                    <Input
                      id="floorNo"
                      placeholder="e.g. 3"
                      value={form.floorNo}
                      onChange={(e) => setForm((f) => ({ ...f, floorNo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doorNo">Door No.</Label>
                  <Input
                    id="doorNo"
                    placeholder="e.g. 301"
                    value={form.doorNo}
                    onChange={(e) => setForm((f) => ({ ...f, doorNo: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Contact Name</Label>
                    <Input
                      id="contactName"
                      placeholder="Owner / Tenant"
                      value={form.contactName}
                      onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactMobile">Contact Mobile</Label>
                    <Input
                      id="contactMobile"
                      placeholder="10-digit number"
                      value={form.contactMobile}
                      onChange={(e) => setForm((f) => ({ ...f, contactMobile: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    placeholder="Full address (optional)"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    rows={2}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Common Area Presets</Label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_AREA_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePresetToggle(preset)}
                        className={cn(
                          'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                          isPresetActive(preset)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary'
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commonAreas">Common Areas (comma-separated)</Label>
                  <Input
                    id="commonAreas"
                    placeholder="e.g. Swimming Pool, Gym"
                    value={form.commonAreas}
                    onChange={(e) => setForm((f) => ({ ...f, commonAreas: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="areaAddress">Address / Info</Label>
                  <Textarea
                    id="areaAddress"
                    placeholder="Location or additional info (optional)"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setForm(EMPTY_FORM); }} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleAddSubmit} disabled={!form.propertyName.trim() || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Upload Dialog ──────────────────────────────────────────── */}
      <Dialog open={bulkOpen} onOpenChange={(o) => { if (!o) handleBulkClose(); else setBulkOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Bulk Upload Properties
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file or paste CSV data to add multiple properties at once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Template Download */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
              <div>
                <p className="text-sm font-medium text-slate-700">Download Template</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Columns: {CSV_COLUMNS}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" className="gap-2" onClick={downloadExcelTemplate}>
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={downloadCSVTemplate}>
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Upload Excel or CSV File</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm text-slate-600">
                  {bulkFile ? bulkFile.name : 'Click to select an Excel (.xlsx) or CSV file'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={handleBulkFileChange}
                />
              </div>
            </div>

            {/* Paste Area */}
            <div className="space-y-2">
              <Label htmlFor="bulkPaste">Or Paste CSV Data</Label>
              <Textarea
                id="bulkPaste"
                placeholder={`${CSV_COLUMNS}\napartment,Tower A,1,101,John Doe,9876543210,,\nothers,,,,,,Swimming Pool,Main pool`}
                value={bulkText}
                onChange={(e) => handleBulkTextChange(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </div>

            {/* Row Count Preview */}
            {bulkRows.length > 0 && !bulkResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{bulkRows.length} row{bulkRows.length !== 1 ? 's' : ''} ready to upload</span>
                </div>
                {/* Preview table */}
                <div className="rounded-md border overflow-hidden">
                  <div className="overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-600 border-r">#</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-600 border-r">Type</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-600 border-r">Tower</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-600 border-r">Floor</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-600 border-r">Door</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-600 border-r">Contact</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-600 border-r">Mobile</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-600 border-r">Area Name</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-600">Info</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-2 py-1 text-slate-400 border-r">{i + 1}</td>
                            <td className="px-2 py-1 border-r">
                              <span className={cn(
                                'px-1.5 py-0.5 rounded text-xs font-medium',
                                ['apartment'].includes(row.propertyType?.toLowerCase() ?? '')
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-violet-100 text-violet-700'
                              )}>
                                {['apartment'].includes(row.propertyType?.toLowerCase() ?? '') ? 'Apartment' : (row.propertyType ? 'Common Area' : '—')}
                              </span>
                            </td>
                            <td className="px-2 py-1 border-r text-slate-700">{row.towerName || <span className="text-slate-300">—</span>}</td>
                            <td className="px-2 py-1 border-r text-slate-700">{row.floorNo || <span className="text-slate-300">—</span>}</td>
                            <td className="px-2 py-1 border-r text-slate-700">{row.doorNo || <span className="text-slate-300">—</span>}</td>
                            <td className="px-2 py-1 border-r text-slate-700">{row.contactName || <span className="text-slate-300">—</span>}</td>
                            <td className="px-2 py-1 border-r text-slate-700">{row.contactMobile || <span className="text-slate-300">—</span>}</td>
                            <td className="px-2 py-1 border-r text-slate-700">{row.areaName || <span className="text-slate-300">—</span>}</td>
                            <td className="px-2 py-1 text-slate-700">{row.info || <span className="text-slate-300">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Result */}
            {bulkResult && (
              <div className="space-y-2">
                <div className="flex gap-3">
                  {bulkResult.success > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      {bulkResult.success} uploaded
                    </div>
                  )}
                  {bulkResult.failed > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
                      <AlertCircle className="h-4 w-4" />
                      {bulkResult.failed} failed
                    </div>
                  )}
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                    <p className="text-xs font-medium text-rose-800 mb-1">Errors:</p>
                    <ul className="text-xs text-rose-700 space-y-0.5 list-disc list-inside">
                      {bulkResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleBulkClose} disabled={isBulkUploading}>
              {bulkResult ? 'Close' : 'Cancel'}
            </Button>
            {!bulkResult && (
              <Button
                onClick={handleBulkUpload}
                disabled={bulkRows.length === 0 || isBulkUploading}
                className="gap-2"
              >
                {isBulkUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload {bulkRows.length > 0 ? `${bulkRows.length} Row${bulkRows.length !== 1 ? 's' : ''}` : ''}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ───────────────────────────────────────── */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this property? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId !== null && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PropertyManagement;
