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
  AlertCircle
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Property {
  id: number;
  propertyName: string;
  propertyType: 'apartment' | 'others';
  towerName?: string;
  floorNo?: string | number;
  doorNo?: string;
  contactName?: string;
  contactMobile?: string;
  commonAreas?: string;
  address?: string;
}

interface NewPropertyForm {
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

interface BulkResult {
  created: Property[];
  errors: string[];
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

const CSV_TEMPLATE = 'propertyType,towerName,floorNo,doorNo,contactName,contactMobile,areaName,info\napartment,Tower A,3,301,John Doe,9876543210,,\nothers,,,,,,,Lobby';

function parseCsvProperties(csv: string): Partial<Property>[] {
  const lines = csv.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    const isApartment = (obj['propertytype'] || obj['propertyType'] || '').toLowerCase() === 'apartment';
    return {
      propertyType: isApartment ? 'apartment' : 'others',
      towerName: obj['towername'] || obj['towerName'] || '',
      floorNo: obj['floorno'] || obj['floorNo'] || '',
      doorNo: obj['doorno'] || obj['doorNo'] || '',
      contactName: obj['contactname'] || obj['contactName'] || '',
      contactMobile: obj['contactmobile'] || obj['contactMobile'] || '',
      commonAreas: obj['areaname'] || obj['areaName'] || obj['commonareas'] || '',
      address: obj['info'] || obj['address'] || '',
      propertyName: isApartment
        ? [obj['towername'] || obj['towerName'], obj['floorno'] || obj['floorNo'], obj['doorno'] || obj['doorNo']].filter(Boolean).join('-')
        : obj['areaname'] || obj['areaName'] || 'Common Area',
    };
  }).filter((p) => p.propertyName);
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'properties_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────────

const PropertyManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  const [newProperty, setNewProperty] = useState<NewPropertyForm>({
    propertyType: 'apartment',
    propertyName: '',
    towerName: '',
    floorNo: '',
    doorNo: '',
    contactName: '',
    contactMobile: '',
    commonAreas: '',
    address: '',
  });

  // ── Data fetching ──
  const associationId = Number(user?.associationId);

  const { data: propertiesData, isLoading } = useQuery({
    queryKey: ['properties', associationId],
    queryFn: () => api.properties.getByAssociation(associationId),
    enabled: !!associationId,
  });

  const rawItems = (propertiesData as any)?.data?.items ?? (propertiesData as any)?.data ?? [];
  const properties: Property[] = Array.isArray(rawItems) ? rawItems : [];

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: Partial<Property>) => api.properties.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', associationId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.properties.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', associationId] });
      toast.success('Property deleted');
    },
    onError: () => toast.error('Failed to delete property'),
  });

  // ── Derived stats ──
  const totalCount = properties.length;
  const apartmentCount = properties.filter((p) => p.propertyType === 'apartment').length;
  const commonAreaCount = properties.filter((p) => p.propertyType !== 'apartment').length;

  // ── Filtered list ──
  const filtered = properties.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      (p.propertyName || '').toLowerCase().includes(q) ||
      (p.towerName || '').toLowerCase().includes(q) ||
      (p.commonAreas || '').toLowerCase().includes(q) ||
      (p.address || '').toLowerCase().includes(q)
    );
  });

  // ── Handlers ──
  const handleDelete = (id: number) => {
    if (!confirm('Delete this property? This action cannot be undone.')) return;
    deleteMutation.mutate(id);
  };

  const handleAddProperty = async () => {
    const { propertyType, towerName, floorNo, doorNo, commonAreas, address } = newProperty;
    if (propertyType === 'apartment' && (!towerName || !floorNo || !doorNo)) {
      toast.error('Please fill in Tower, Floor, and Door fields');
      return;
    }
    if (propertyType === 'others' && !commonAreas && !address) {
      toast.error('Please provide an area name or address');
      return;
    }

    const autoName =
      propertyType === 'apartment'
        ? [towerName, floorNo, doorNo].filter(Boolean).join('-')
        : commonAreas || address || 'Common Area';

    const payload: Partial<Property> = {
      ...newProperty,
      propertyName: newProperty.propertyName || autoName,
      associationId,
    } as any;

    try {
      const res = await createMutation.mutateAsync(payload);
      if ((res as any)?.success !== false) {
        toast.success('Property added successfully');
        setIsAddDialogOpen(false);
        setNewProperty({
          propertyType: 'apartment',
          propertyName: '',
          towerName: '',
          floorNo: '',
          doorNo: '',
          contactName: '',
          contactMobile: '',
          commonAreas: '',
          address: '',
        });
      } else {
        toast.error((res as any)?.message || 'Failed to add property');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add property');
    }
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBulkCsvText((ev.target?.result as string) ?? '');
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBulkUpload = async () => {
    const rows = parseCsvProperties(bulkCsvText);
    if (!rows.length) {
      toast.error('No valid rows found. Check the CSV format.');
      return;
    }
    setIsBulkUploading(true);
    setBulkResult(null);
    const created: Property[] = [];
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const res = await api.properties.create({ ...row, associationId } as any);
        if ((res as any)?.success !== false && (res as any)?.data) {
          created.push((res as any).data);
        } else {
          errors.push(`Row "${row.propertyName}": ${(res as any)?.message || 'Failed'}`);
        }
      } catch (e: any) {
        errors.push(`Row "${row.propertyName}": ${e?.message || 'Error'}`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['properties', associationId] });
    setBulkResult({ created, errors });
    setIsBulkUploading(false);
    toast.success(`Bulk upload complete: ${created.length} properties created`);
  };

  // ── Styling constants (matching UserManagement) ──
  const headerBg = 'bg-primary';
  const headerText = 'text-white font-semibold last:border-r-0 h-11';
  const cellBorder = 'border-r border-slate-200 last:border-r-0';

  // ── Property icon helper ──
  const PropertyIcon = ({ type }: { type: string }) => {
    if (type === 'apartment') {
      return (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
          <Home className="h-4 w-4 text-blue-600" />
        </div>
      );
    }
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
        <MapPin className="h-4 w-4 text-emerald-600" />
      </div>
    );
  };

  const getDetails = (p: Property) => {
    if (p.propertyType === 'apartment') {
      const parts = [
        p.towerName && `Tower: ${p.towerName}`,
        p.floorNo && `Floor: ${p.floorNo}`,
        p.doorNo && `Door: ${p.doorNo}`,
      ].filter(Boolean);
      return parts.join(' · ') || '—';
    }
    return [p.commonAreas, p.address].filter(Boolean).join(' · ') || '—';
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">

        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden sm:block space-y-6 mb-6">

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Property Management</h1>
              <p className="text-muted-foreground">Manage apartments, towers, and common areas</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => { setBulkCsvText(''); setBulkResult(null); setIsBulkDialogOpen(true); }}
              >
                <Upload className="h-4 w-4" />
                Bulk Upload
              </Button>
              <Button
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Property
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalCount}</p>
                  <p className="text-sm text-muted-foreground">Total Properties</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100/50">
                  <Layers className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{apartmentCount}</p>
                  <p className="text-sm text-muted-foreground">Apartments / Towers</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100/50">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{commonAreaCount}</p>
                  <p className="text-sm text-muted-foreground">Common Areas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table card */}
          <Card className="overflow-hidden border-none shadow-md">
            <CardHeader className="bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-lg">All Properties</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search properties..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border border-slate-200 m-6 mt-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table className="border-x">
                    <TableHeader className={cn(headerBg, 'hover:bg-primary')}>
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className={headerText}>Property Name</TableHead>
                        <TableHead className={headerText}>Type</TableHead>
                        <TableHead className={headerText}>Details</TableHead>
                        <TableHead className="text-right text-white font-semibold px-4 h-11">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                            Loading properties...
                          </TableCell>
                        </TableRow>
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                            {searchQuery ? 'No properties match your search.' : 'No properties found. Add your first property.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((property) => (
                          <TableRow key={property.id} className="hover:bg-slate-50/50">
                            <TableCell className={cellBorder}>
                              <div className="flex items-center gap-3">
                                <PropertyIcon type={property.propertyType} />
                                <div>
                                  <p className="font-medium">{property.propertyName}</p>
                                  {property.contactName && (
                                    <p className="text-xs text-muted-foreground">{property.contactName}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className={cellBorder}>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-xs font-semibold',
                                  property.propertyType === 'apartment'
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                )}
                              >
                                {property.propertyType === 'apartment' ? 'Apartment' : 'Common Area'}
                              </Badge>
                            </TableCell>
                            <TableCell className={cn(cellBorder, 'text-slate-500 text-sm')}>
                              {getDetails(property)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(property.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="block sm:hidden bg-slate-50 -mx-4 -mt-4 min-h-screen">
          {/* Mobile header */}
          <div className="bg-primary pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black tracking-tight truncate">Property Management</h1>
                <p className="text-[10px] text-white/70 font-bold uppercase mt-1 italic tracking-widest leading-relaxed">
                  Apartments, towers &amp; common areas
                </p>
              </div>
              <Button
                variant="ghost"
                className="bg-white/10 text-white rounded-2xl h-11 w-11 p-0 shrink-0 backdrop-blur-md border-0"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                className="bg-white/10 text-white rounded-2xl h-11 w-11 p-0 shrink-0 backdrop-blur-md border-0"
                onClick={() => { setBulkCsvText(''); setBulkResult(null); setIsBulkDialogOpen(true); }}
              >
                <Upload className="h-5 w-5" />
              </Button>
            </div>

            {/* Mobile stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <Building2 className="h-4 w-4 text-white mb-1 opacity-80" />
                <p className="text-xl font-black">{totalCount}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Total</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <Layers className="h-4 w-4 text-blue-300 mb-1 opacity-80" />
                <p className="text-xl font-black">{apartmentCount}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Apts</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <MapPin className="h-4 w-4 text-emerald-300 mb-1 opacity-80" />
                <p className="text-xl font-black">{commonAreaCount}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Common</p>
              </div>
            </div>
          </div>

          {/* Mobile list */}
          <div className="px-5 -mt-6 relative z-20 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-12 pr-4 rounded-2xl bg-white border-none shadow-xl ring-1 ring-black/5 font-bold text-sm"
              />
            </div>

            <div className="space-y-3 pb-8">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <p className="text-sm font-bold text-slate-500">Loading...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <Building2 className="h-8 w-8 text-slate-400 mb-2" />
                  <p className="text-sm font-bold text-slate-500">No properties found</p>
                </div>
              ) : (
                filtered.map((property) => (
                  <div
                    key={property.id}
                    className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-black/5 flex items-start gap-4"
                  >
                    <div
                      className={cn(
                        'h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm',
                        property.propertyType === 'apartment'
                          ? 'bg-blue-100'
                          : 'bg-emerald-100'
                      )}
                    >
                      {property.propertyType === 'apartment' ? (
                        <Home className="h-5 w-5 text-blue-600" />
                      ) : (
                        <MapPin className="h-5 w-5 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-black text-slate-800 truncate">{property.propertyName}</h4>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[9px] font-bold shrink-0',
                            property.propertyType === 'apartment'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {property.propertyType === 'apartment' ? 'Apt' : 'Area'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 font-medium truncate">{getDetails(property)}</p>
                      {property.contactName && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{property.contactName}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100"
                      onClick={() => handleDelete(property.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== ADD PROPERTY DIALOG ===== */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-card sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Add Property
            </DialogTitle>
            <DialogDescription>
              Add a new apartment unit or common area to the association.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type selector */}
            <div className="space-y-2">
              <Label>Property Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewProperty((p) => ({ ...p, propertyType: 'apartment' }))}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold transition-all',
                    newProperty.propertyType === 'apartment'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  )}
                >
                  <Home className="h-4 w-4" />
                  Apartment
                </button>
                <button
                  type="button"
                  onClick={() => setNewProperty((p) => ({ ...p, propertyType: 'others' }))}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold transition-all',
                    newProperty.propertyType === 'others'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  )}
                >
                  <MapPin className="h-4 w-4" />
                  Common Area
                </button>
              </div>
            </div>

            {newProperty.propertyType === 'apartment' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="towerName">Tower Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="towerName"
                    placeholder="e.g. Tower A"
                    value={newProperty.towerName}
                    onChange={(e) => setNewProperty((p) => ({ ...p, towerName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="floorNo">Floor No. <span className="text-destructive">*</span></Label>
                    <Input
                      id="floorNo"
                      placeholder="e.g. 3"
                      value={newProperty.floorNo}
                      onChange={(e) => setNewProperty((p) => ({ ...p, floorNo: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doorNo">Door No. <span className="text-destructive">*</span></Label>
                    <Input
                      id="doorNo"
                      placeholder="e.g. 301"
                      value={newProperty.doorNo}
                      onChange={(e) => setNewProperty((p) => ({ ...p, doorNo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="contactName"
                    placeholder="Resident name"
                    value={newProperty.contactName}
                    onChange={(e) => setNewProperty((p) => ({ ...p, contactName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactMobile">Contact Mobile <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="contactMobile"
                    placeholder="Phone number"
                    value={newProperty.contactMobile}
                    onChange={(e) => setNewProperty((p) => ({ ...p, contactMobile: e.target.value }))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="commonAreas">Area Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="commonAreas"
                    placeholder="e.g. Lobby, Gym, Parking"
                    value={newProperty.commonAreas}
                    onChange={(e) => setNewProperty((p) => ({ ...p, commonAreas: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Additional Info <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="address"
                    placeholder="Location or description"
                    value={newProperty.address}
                    onChange={(e) => setNewProperty((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="propertyName">
                Custom Property Name <span className="text-muted-foreground text-xs">(optional — auto-generated if blank)</span>
              </Label>
              <Input
                id="propertyName"
                placeholder="Leave blank to auto-generate"
                value={newProperty.propertyName}
                onChange={(e) => setNewProperty((p) => ({ ...p, propertyName: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={handleAddProperty}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Property
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== BULK UPLOAD DIALOG ===== */}
      <Dialog
        open={isBulkDialogOpen}
        onOpenChange={(o) => {
          setIsBulkDialogOpen(o);
          if (!o) { setBulkResult(null); setBulkCsvText(''); }
        }}
      >
        <DialogContent className="bg-card sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Bulk Upload Properties
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file to create multiple properties at once.
            </DialogDescription>
          </DialogHeader>

          {!bulkResult ? (
            <div className="space-y-4 py-2">
              {/* Template download */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Download Template</p>
                  <p className="text-xs text-slate-500">
                    Columns: propertyType, towerName, floorNo, doorNo, contactName, contactMobile, areaName, info
                  </p>
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
                <input
                  ref={bulkFileRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleBulkFileUpload}
                />
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-semibold text-slate-600">Click to upload CSV file</p>
                <p className="text-xs text-slate-400 mt-1">or paste CSV data below</p>
              </div>

              {/* Manual CSV paste */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Or paste CSV data</Label>
                <textarea
                  className="w-full h-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={"propertyType,towerName,floorNo,doorNo,contactName,contactMobile,areaName,info\napartment,Tower A,3,301,John Doe,9876543210,,\nothers,,,,,,,Lobby"}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                />
              </div>

              {bulkCsvText.trim() && (
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-primary">
                    {parseCsvProperties(bulkCsvText).length}
                  </span>{' '}
                  valid rows detected
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-semibold text-emerald-700">
                  {bulkResult.created.length} properties created successfully
                </p>
              </div>
              {bulkResult.errors.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs font-semibold text-amber-700">
                      {bulkResult.errors.length} skipped:
                    </p>
                  </div>
                  {bulkResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-amber-600 pl-6">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
              Close
            </Button>
            {!bulkResult && (
              <Button
                onClick={handleBulkUpload}
                disabled={isBulkUploading || !bulkCsvText.trim()}
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
                    Upload Properties
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PropertyManagement;
