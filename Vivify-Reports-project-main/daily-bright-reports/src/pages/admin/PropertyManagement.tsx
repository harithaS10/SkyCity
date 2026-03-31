import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { 
  Building2, 
  Home, 
  Plus, 
  Trash2, 
  Settings, 
  ChevronRight,
  MoreVertical,
  Building,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const PropertyManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('properties');
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [propDialogOpen, setPropDialogOpen] = useState(false);
  const [propForm, setPropForm] = useState({ propertyName: '', address: '', totalUnits: '' });
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [buildingForm, setBuildingForm] = useState({ buildingName: '', floors: '' });
  const [bulkUnitDialogOpen, setBulkUnitDialogOpen] = useState(false);
  const [bulkUnitForm, setBulkUnitForm] = useState({ fromFloor: '1', toFloor: '', unitsPerFloor: '' });

  // Queries
  const { data: propertiesRes, isLoading: isLoadingProps } = useQuery({
    queryKey: ['properties', user?.associationId],
    queryFn: () => api.properties.getByAssociation(Number(user?.associationId))
  });

  const { data: buildingsRes, isLoading: isLoadingBuildings } = useQuery({
    queryKey: ['buildings', selectedPropertyId],
    queryFn: () => selectedPropertyId ? api.properties.getBuildings(selectedPropertyId) : Promise.resolve({ success: true, data: [] }),
    enabled: !!selectedPropertyId
  });

  const { data: unitsRes, isLoading: isLoadingUnits } = useQuery({
    queryKey: ['units', selectedBuildingId],
    queryFn: () => selectedBuildingId ? api.properties.getUnits(selectedBuildingId) : Promise.resolve({ success: true, data: [] }),
    enabled: !!selectedBuildingId
  });

  const createPropertyMutation = useMutation({
    mutationFn: (data: any) => api.properties.create({ ...data, associationId: user?.associationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property created successfully');
      setPropDialogOpen(false);
      setPropForm({ propertyName: '', address: '', totalUnits: '' });
    },
    onError: () => toast.error('Failed to create property')
  });

  const createBuildingMutation = useMutation({
    mutationFn: (data: any) => api.properties.createBuilding({ ...data, propertyId: selectedPropertyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      toast.success('Building created successfully');
      setBuildingDialogOpen(false);
      setBuildingForm({ buildingName: '', floors: '' });
    },
    onError: () => toast.error('Failed to create building')
  });

  const createUnitsBulkMutation = useMutation({
    mutationFn: (data: any) => {
      if (!selectedBuildingId) throw new Error('No building selected');
      return api.properties.createUnitsBulk({ ...data, buildingId: selectedBuildingId });
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast.success(res.message || 'Units created successfully');
      setBulkUnitDialogOpen(false);
      setBulkUnitForm({ fromFloor: '1', toFloor: '', unitsPerFloor: '' });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to create units')
  });

  const deletePropertyMutation = useMutation({
    mutationFn: (id: number) => api.properties.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property deleted');
    }
  });

  const properties = (propertiesRes?.data as any)?.items ?? propertiesRes?.data ?? [];
  const buildings = buildingsRes?.data || [];
  const units = unitsRes?.data || [];

  return (
    <DashboardLayout>
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community Infrastructure</h1>
          <p className="text-muted-foreground mt-1">Manage Properties, Buildings, and Units for your Association</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="properties" className="gap-2">
            <Building2 size={14} /> Properties
          </TabsTrigger>
          <TabsTrigger value="buildings" className="gap-2" disabled={!selectedPropertyId}>
            <Building size={14} /> Buildings
          </TabsTrigger>
          <TabsTrigger value="units" className="gap-2" disabled={!selectedBuildingId}>
            <Home size={14} /> Units
          </TabsTrigger>
        </TabsList>

        {/* Properties Tab */}
        <TabsContent value="properties" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-none shadow-sm ring-1 ring-slate-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Properties</CardTitle>
                  <CardDescription>All residential and commercial properties in this association</CardDescription>
                </div>
                <Dialog open={propDialogOpen} onOpenChange={setPropDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus size={16} /> Add Property
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Property</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Property Name</Label>
                        <Input
                          placeholder="e.g. Skycity Residency"
                          value={propForm.propertyName}
                          onChange={e => setPropForm(f => ({ ...f, propertyName: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Address</Label>
                        <Input
                          placeholder="e.g. Sector 45, Kochi"
                          value={propForm.address}
                          onChange={e => setPropForm(f => ({ ...f, address: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Units</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 50"
                          value={propForm.totalUnits}
                          onChange={e => setPropForm(f => ({ ...f, totalUnits: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        disabled={!propForm.propertyName || createPropertyMutation.isPending}
                        onClick={() => createPropertyMutation.mutate({
                          propertyName: propForm.propertyName,
                          address: propForm.address,
                          totalUnits: Number(propForm.totalUnits) || 0
                        })}
                      >
                        {createPropertyMutation.isPending ? 'Creating...' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {isLoadingProps ? (
                    <p className="text-center py-4 text-muted-foreground italic">Loading properties...</p>
                  ) : properties.length > 0 ? (
                    properties.map((p: any) => (
                      <div 
                        key={p.id} 
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${selectedPropertyId === p.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-card'}`}
                        onClick={() => {
                          setSelectedPropertyId(p.id);
                          setSelectedBuildingId(null);
                          setActiveTab('buildings');
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                            <Building2 className="text-slate-500" size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{p.propertyName}</p>
                            <p className="text-xs text-muted-foreground">{p.location}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-slate-50">{p.type || 'Residential'}</Badge>
                          <ChevronRight size={16} className="text-slate-400" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50/50">
                      <Building2 className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                      <p className="text-slate-500">No properties found. Start by adding one!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-slate-200 h-fit">
              <CardHeader>
                <CardTitle>Guidelines</CardTitle>
                <CardDescription>Setup your community hierarchy</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-4 text-slate-600">
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs">1</div>
                  <p>Add Properties like blocks or independent campuses.</p>
                </div>
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs">2</div>
                  <p>Define Buildings within each property.</p>
                </div>
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs">3</div>
                  <p>Create Units (flats/offices) and assign residents.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Buildings Tab */}
        <TabsContent value="buildings" className="space-y-4">
           {/* Similar logic for buildings list */}
           <Card className="border-none shadow-sm ring-1 ring-slate-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Buildings in {properties.find(p => p.id === selectedPropertyId)?.propertyName}</CardTitle>
                  <CardDescription>Manage individual blocks or towers</CardDescription>
                </div>
                <Dialog open={buildingDialogOpen} onOpenChange={setBuildingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2"><Plus size={16} /> Add Building</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Building</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Building Name</Label>
                        <Input
                          placeholder="e.g. Tower A"
                          value={buildingForm.buildingName}
                          onChange={e => setBuildingForm(f => ({ ...f, buildingName: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Floors</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 10"
                          value={buildingForm.floors}
                          onChange={e => setBuildingForm(f => ({ ...f, floors: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        disabled={!buildingForm.buildingName || createBuildingMutation.isPending}
                        onClick={() => createBuildingMutation.mutate({
                          buildingName: buildingForm.buildingName,
                          floors: Number(buildingForm.floors) || 0
                        })}
                      >
                        {createBuildingMutation.isPending ? 'Creating...' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {isLoadingBuildings ? (
                    <p className="col-span-full text-center">Loading buildings...</p>
                  ) : buildings.length > 0 ? (
                    buildings.map((b: any) => (
                      <Card 
                        key={b.id} 
                        className={`cursor-pointer hover:border-primary transition-all ${selectedBuildingId === b.id ? 'border-primary bg-primary/5' : ''}`}
                        onClick={() => {
                          setSelectedBuildingId(b.id);
                          setActiveTab('units');
                        }}
                      >
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-slate-100">
                              <Building className="text-slate-600" size={20} />
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={14} /></Button>
                          </div>
                          <h3 className="font-bold text-lg">{b.buildingName}</h3>
                          <p className="text-sm text-muted-foreground mb-4">{b.floors} Floors | {b.totalUnits} Units</p>
                          <div className="flex items-center gap-1 text-xs text-primary font-medium">
                            Manage Units <ChevronRight size={12} />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">No buildings found.</div>
                  )}
                </div>
              </CardContent>
           </Card>
        </TabsContent>

        {/* Units Tab */}
        <TabsContent value="units" className="space-y-4">
           <Card className="border-none shadow-sm ring-1 ring-slate-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Units in {buildings.find(b => b.id === selectedBuildingId)?.buildingName}</CardTitle>
                  <CardDescription>Residence and tenant management</CardDescription>
                </div>
                <Dialog open={bulkUnitDialogOpen} onOpenChange={setBulkUnitDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2"><Plus size={16} /> Add Units in Bulk</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Units in Bulk</DialogTitle>
                      <DialogDescription>
                        Auto-generate units for a floor range. e.g. floors 1–5, 4 units/floor → 101–504.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>From Floor</Label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="1"
                            value={bulkUnitForm.fromFloor}
                            onChange={e => setBulkUnitForm(f => ({ ...f, fromFloor: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>To Floor</Label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="10"
                            value={bulkUnitForm.toFloor}
                            onChange={e => setBulkUnitForm(f => ({ ...f, toFloor: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Units per Floor</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="4"
                          value={bulkUnitForm.unitsPerFloor}
                          onChange={e => setBulkUnitForm(f => ({ ...f, unitsPerFloor: e.target.value }))}
                        />
                      </div>
                      {bulkUnitForm.toFloor && bulkUnitForm.unitsPerFloor && (
                        <p className="text-sm text-muted-foreground bg-slate-50 rounded-lg p-3">
                          This will create <span className="font-semibold text-foreground">
                            {(Number(bulkUnitForm.toFloor) - Number(bulkUnitForm.fromFloor) + 1) * Number(bulkUnitForm.unitsPerFloor)}
                          </span> units across floors {bulkUnitForm.fromFloor}–{bulkUnitForm.toFloor}.
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        disabled={!bulkUnitForm.toFloor || !bulkUnitForm.unitsPerFloor || createUnitsBulkMutation.isPending}
                        onClick={() => createUnitsBulkMutation.mutate({
                          fromFloor: Number(bulkUnitForm.fromFloor),
                          toFloor: Number(bulkUnitForm.toFloor),
                          unitsPerFloor: Number(bulkUnitForm.unitsPerFloor)
                        })}
                      >
                        {createUnitsBulkMutation.isPending ? 'Creating...' : 'Create Units'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {isLoadingUnits ? (
                    <p className="col-span-full text-center">Loading units...</p>
                  ) : units.length > 0 ? (
                    units.map((u: any) => (
                      <div key={u.id} className="p-3 rounded-lg border bg-card hover:bg-slate-50 transition-colors group relative">
                        <p className="text-lg font-bold">{u.unitNumber}</p>
                        <p className="text-[10px] text-muted-foreground truncate uppercase">{u.type}</p>
                        <div className="mt-2 pt-2 border-t flex items-center justify-between">
                           {u.residentId ? (
                             <Badge className="bg-emerald-50 text-emerald-700 text-[10px] hover:bg-emerald-50">Occupied</Badge>
                           ) : (
                             <Badge variant="outline" className="text-[10px]">Vacant</Badge>
                           )}
                           <Users size={12} className="text-slate-400" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">No units defined.</div>
                  )}
                </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
    </DashboardLayout>
  );
};

export default PropertyManagement;
