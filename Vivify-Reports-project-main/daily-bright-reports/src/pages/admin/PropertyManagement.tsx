import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Building2, Building, Plus, Trash2, Layers, DoorOpen, Waves, Phone, User, Info, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const COMMON_AREAS = ['Swimming Pool', 'Club House', 'Gym', 'Parking', 'Garden', 'Terrace'];

const PropertyManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [propType, setPropType] = useState<'apartment' | 'others'>('apartment');
  const [towerNames, setTowerNames] = useState<string[]>(['']);
  const [form, setForm] = useState({
    towerName: '', floorNo: '', doorNo: '', contactName: '', contactMobile: '',
    areaName: '', info: '',
  });

  const reset = () => {
    setPropType('apartment');
    setForm({ towerName: '', floorNo: '', doorNo: '', contactName: '', contactMobile: '', areaName: '', info: '' });
  };

  const { data: res, isLoading } = useQuery({
    queryKey: ['properties', user?.associationId],
    queryFn: () => api.properties.getByAssociation(Number(user?.associationId)),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.properties.create({ ...data, associationId: user?.associationId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['properties'] }); toast.success('Property created'); setOpen(false); reset(); },
    onError: () => toast.error('Failed to create property'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.properties.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['properties'] }); toast.success('Property deleted'); },
  });

  const properties = (res?.data as any)?.items ?? res?.data ?? [];
  const canCreate = propType === 'apartment' ? !!form.towerName : !!form.areaName;

  const handleCreate = () => {
    createMutation.mutate({
      propertyName: propType === 'apartment' ? form.towerName : form.areaName,
      address: form.info,
      totalUnits: 0,
      propertyType: propType,
      towerName: propType === 'apartment' ? form.towerName : undefined,
      floorNo: propType === 'apartment' ? form.floorNo : undefined,
      doorNo: propType === 'apartment' ? form.doorNo : undefined,
      contactName: propType === 'apartment' ? form.contactName : undefined,
      contactMobile: propType === 'apartment' ? form.contactMobile : undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Community Infrastructure</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage properties for your association</p>
          </div>

          <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus size={16} /> Add Property</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Property</DialogTitle>
                  <DialogDescription>Choose the property type to configure the right details.</DialogDescription>
                </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  {(['apartment', 'others'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setPropType(t)}
                      className={cn('flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all text-sm font-semibold',
                        propType === t ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-500 hover:border-slate-300')}>
                      {t === 'apartment' ? <Building2 size={22} /> : <Waves size={22} />}
                      {t === 'apartment' ? 'Apartment / Tower' : 'Common Area / Others'}
                    </button>
                  ))}
                </div>

                {propType === 'apartment' ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5"><Building size={13} /> Tower Name *</Label>
                      <Input placeholder="e.g. Tower A, Block B" value={form.towerName} onChange={e => setForm(f => ({ ...f, towerName: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5"><Layers size={13} /> Floor No.</Label>
                        <Input type="number" placeholder="e.g. 5" value={form.floorNo} onChange={e => setForm(f => ({ ...f, floorNo: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5"><DoorOpen size={13} /> Door No.</Label>
                        <Input type="number" placeholder="e.g. 501" value={form.doorNo} onChange={e => setForm(f => ({ ...f, doorNo: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Contact Name</Label>
                        <Input placeholder="e.g. John Doe" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Mobile No.</Label>
                        <Input type="number" placeholder="e.g. 9876543210" value={form.contactMobile} onChange={e => setForm(f => ({ ...f, contactMobile: e.target.value }))} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>Area Name *</Label>
                      <Input placeholder="e.g. Swimming Pool" value={form.areaName} onChange={e => setForm(f => ({ ...f, areaName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Quick Add</Label>
                      <div className="flex flex-wrap gap-2">
                        {COMMON_AREAS.map(area => (
                          <button key={area} type="button" onClick={() => setForm(f => ({ ...f, areaName: area }))}
                            className={cn('text-xs px-2.5 py-1 rounded-full border transition-all',
                              form.areaName === area ? 'bg-primary/10 border-primary/30 text-primary' : 'border-slate-200 hover:border-primary hover:text-primary')}>
                            + {area}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Information</Label>
                      <Input placeholder="e.g. Open 6am–10pm, capacity 50" value={form.info} onChange={e => setForm(f => ({ ...f, info: e.target.value }))} />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
                <Button disabled={!canCreate || createMutation.isPending} onClick={handleCreate}>
                  {createMutation.isPending ? 'Creating...' : 'Create Property'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground">Loading properties...</p>
        ) : properties.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-xl bg-slate-50/50">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-medium">No properties found.</p>
            <p className="text-slate-400 text-sm mt-1">Click "Add Property" to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {properties.map((p: any) => (
              <Card key={p.id} className="border shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center',
                        p.propertyType === 'others' ? 'bg-emerald-100' : 'bg-primary/10')}>
                        {p.propertyType === 'others'
                          ? <Waves size={20} className="text-emerald-600" />
                          : <Building2 size={20} className="text-primary" />}
                      </div>
                      <div>
                        <CardTitle className="text-base">{p.propertyName}</CardTitle>
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          {p.propertyType === 'others' ? 'Common Area' : 'Apartment / Tower'}
                        </Badge>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 size={14} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Property?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove "{p.propertyName}".</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm pt-0">
                  {p.propertyType !== 'others' ? (
                    <>
                      {p.towerName && <div className="flex items-center gap-2 text-muted-foreground"><Building size={13} /><span>Tower: <span className="text-foreground font-medium">{p.towerName}</span></span></div>}
                      <div className="flex items-center gap-4">
                        {p.floorNo && <div className="flex items-center gap-2 text-muted-foreground"><Layers size={13} /><span>Floor: <span className="text-foreground font-medium">{p.floorNo}</span></span></div>}
                        {p.doorNo && <div className="flex items-center gap-2 text-muted-foreground"><DoorOpen size={13} /><span>Door: <span className="text-foreground font-medium">{p.doorNo}</span></span></div>}
                      </div>
                      {p.contactName && <div className="flex items-center gap-2 text-muted-foreground"><User size={13} /><span className="text-foreground font-medium">{p.contactName}</span></div>}
                      {p.contactMobile && <div className="flex items-center gap-2 text-muted-foreground"><Phone size={13} /><span className="text-foreground font-medium">{p.contactMobile}</span></div>}
                    </>
                  ) : (
                    <>
                      {p.commonAreas && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin size={13} className="mt-0.5 shrink-0" />
                          <div className="flex flex-wrap gap-1">
                            {p.commonAreas.split(',').map((a: string) => <Badge key={a} variant="secondary" className="text-[10px]">{a.trim()}</Badge>)}
                          </div>
                        </div>
                      )}
                      {p.address && <div className="flex items-center gap-2 text-muted-foreground"><Info size={13} /><span>{p.address}</span></div>}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PropertyManagement;
