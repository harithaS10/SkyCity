import React, { useState, useRef } from 'react';
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

function parseCSV(text: string): BulkRow[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return [];
  // skip header if present
  const firstLine = lines[0].trim().toLowerCase();
  const startIdx = firstLine.startsWith('propertytype') ? 1 : 0;
  return lines.slice(startIdx).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    return {
      propertyType: cols[0] || '',
      towerName: cols[1] || '',
      floorNo: cols[2] || '',
      doorNo: cols[3] || '',
      contactName: cols[4] || '',
      contactMobile: cols[5] || '',
      areaName: cols[6] || '',
      info: cols[7] || '',
    };
  });
}

function downloadCSVTemplate() {
  const sample = [
    CSV_COLUMNS,
    'apartment,Tower A,1,101,John Doe,9876543210,,',
    'others,,,,,,Swimming Pool,Main pool area',
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
    const payload: Partial<PropertyItem> = {
      propertyType: form.propertyType,
      propertyName: form.propertyName.trim(),
    };
    if (form.propertyType === 'apartment') {
      if (form.towerName) payload.towerName = form.towerName.trim();
      if (form.floorNo) payload.floorNo = form.floorNo.trim();
      if (form.doorNo) payload.doorNo = form.doorNo.trim();
      if (form.contactName) payload.contactName = form.contactName.trim();
      if (form.contactMobile) payload.contactMobile = form.contactMobile.trim();
      if (form.address) payload.address = form.address.trim();
    } else {
      if (form.commonAreas) payload.commonAreas = form.commonAreas.trim();
      if (form.address) payload.address = form.address.trim();
    }
    createMutation.mutate(payload);
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setBulkText(text);
      setBulkRows(parseCSV(text));
    };
    reader.readAsText(file);
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
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < bulkRows.length; i++) {
      const row = bulkRows[i];
      const rowNum = i + 1;
      try {
        const isApartment = row.propertyType?.toLowerCase() === 'apartment';
        const propertyName = isApartment
          ? row.areaName || `${row.towerName}-${row.floorNo}-${row.doorNo}`.replace(/^-+|-+$/g, '')
          : row.areaName;
        if (!propertyName) {
          errors.push(`Row ${rowNum}: Missing property name`);
          failed++;
          continue;
        }
        const payload: Partial<PropertyItem> = {
          propertyType: isApartment ? 'apartment' : 'others',
          propertyName,
          towerName: row.towerName || undefined,
          floorNo: row.floorNo || undefined,
          doorNo: row.doorNo || undefined,
          contactName: row.contactName || undefined,
          contactMobile: row.contactMobile || undefined,
          commonAreas: !isApartment ? row.info || undefined : undefined,
          address: isApartment ? row.info || undefined : undefined,
        };
        await api.properties.create(payload);
        success++;
      } catch (e: any) {
        errors.push(`Row ${rowNum}: ${e?.message || 'Unknown error'}`);
        failed++;
      }
    }

    setIsBulkUploading(false);
    setBulkResult({ success, failed, errors });
    if (success > 0) {
      queryClient.invalidateQueries({ queryKey: ['properties', user?.associationId] });
      toast.success(`${success} propert${success === 1 ? 'y' : 'ies'} uploaded`);
    }
    if (failed > 0) {
      toast.error(`${failed} row${failed === 1 ? '' : 's'} failed`);
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
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Property Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage apartments, towers, and common areas for your association.
            </p>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-3 rounded-xl bg-blue-100">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Properties</p>
                <p className="text-2xl font-bold text-slate-900">{totalProperties}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-3 rounded-xl bg-emerald-100">
                <Home className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Apartments / Towers</p>
                <p className="text-2xl font-bold text-slate-900">{apartments}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="p-3 rounded-xl bg-violet-100">
                <Layers className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Common Areas</p>
                <p className="text-2xl font-bold text-slate-900">{commonAreas}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Desktop Table */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Properties ({properties.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-lg bg-slate-50">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500 font-medium">No properties found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {search ? 'Try a different search term.' : 'Add your first property to get started.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Property Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {properties.map((prop, i) => (
                      <TableRow key={prop.id}>
                        <TableCell className="text-slate-500">{i + 1}</TableCell>
                        <TableCell className="font-medium">{prop.propertyName}</TableCell>
                        <TableCell>
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
                        <TableCell>
                          <div className="text-sm space-y-0.5">
                            {prop.towerName && (
                              <div className="text-slate-600">
                                <span className="text-slate-400">Tower:</span> {prop.towerName}
                              </div>
                            )}
                            {prop.floorNo && (
                              <div className="text-slate-600">
                                <span className="text-slate-400">Floor:</span> {prop.floorNo}
                              </div>
                            )}
                            {prop.doorNo && (
                              <div className="text-slate-600">
                                <span className="text-slate-400">Door:</span> {prop.doorNo}
                              </div>
                            )}
                            {prop.commonAreas && (
                              <div className="text-slate-600">
                                <span className="text-slate-400">Areas:</span> {prop.commonAreas}
                              </div>
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
                        <TableCell>
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
                            variant="outline"
                            size="sm"
                            className="gap-1 text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                            onClick={() => setDeleteConfirmId(prop.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile Card List */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-lg bg-slate-50">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 font-medium">No properties found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? 'Try a different search term.' : 'Add your first property to get started.'}
              </p>
            </div>
          ) : (
            properties.map((prop) => (
              <Card key={prop.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 truncate">{prop.propertyName}</span>
                        {prop.propertyType === 'apartment' ? (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-0 shrink-0">
                            <Home className="h-3 w-3 mr-1" />
                            Apartment
                          </Badge>
                        ) : (
                          <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100 border-0 shrink-0">
                            <Layers className="h-3 w-3 mr-1" />
                            Common Area
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-slate-600 space-y-1">
                        {prop.towerName && <div><span className="text-slate-400">Tower:</span> {prop.towerName}</div>}
                        {prop.floorNo && <div><span className="text-slate-400">Floor:</span> {prop.floorNo}</div>}
                        {prop.doorNo && <div><span className="text-slate-400">Door:</span> {prop.doorNo}</div>}
                        {prop.contactName && <div><span className="text-slate-400">Contact:</span> {prop.contactName}</div>}
                        {prop.contactMobile && <div><span className="text-slate-400">Mobile:</span> {prop.contactMobile}</div>}
                        {prop.commonAreas && <div><span className="text-slate-400">Areas:</span> {prop.commonAreas}</div>}
                        {prop.address && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {prop.address}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50 hover:border-rose-200 shrink-0"
                      onClick={() => setDeleteConfirmId(prop.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
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
                <p className="text-sm font-medium text-slate-700">Download CSV Template</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Columns: {CSV_COLUMNS}
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={downloadCSVTemplate}>
                <Download className="h-4 w-4" />
                Template
              </Button>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Upload CSV File</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm text-slate-600">
                  {bulkFile ? bulkFile.name : 'Click to select a CSV file'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
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
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{bulkRows.length} row{bulkRows.length !== 1 ? 's' : ''} ready to upload</span>
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
