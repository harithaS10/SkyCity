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
      <div className="animate-fade-in">
        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden sm:block p-6 space-y-6 max-w-5xl mx-auto mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Community Infrastructure</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Manage properties for your association</p>
            </div>
            <Button onClick={() => setOpen(true)} className="gap-2"><Plus size={16} /> Add Property</Button>
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

        {/* ===== MOBILE VIEW ===== */}
        <div className="block sm:hidden bg-slate-50 -mx-4 -mt-4 min-h-screen">
          <div className="bg-primary pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black tracking-tight truncate">Properties</h1>
                <p className="text-[10px] text-white/70 font-bold uppercase mt-1 italic tracking-widest leading-relaxed">Community Infrastructure</p>
              </div>
              <Button variant="ghost" className="bg-white/10 text-white rounded-2xl h-11 w-11 p-0 shrink-0 backdrop-blur-md border-0" onClick={() => setOpen(true)}>
                <Plus className="h-6 w-6" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <Building2 className="h-5 w-5 text-white mb-1.5 opacity-80" />
                <p className="text-2xl font-black">{properties.filter((p: any) => p.propertyType !== 'others').length}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Towers / Units</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
                <Waves className="h-5 w-5 text-emerald-300 mb-1.5 opacity-80" />
                <p className="text-2xl font-black">{properties.filter((p: any) => p.propertyType === 'others').length}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70">Common Areas</p>
              </div>
            </div>
          </div>

          <div className="px-5 -mt-6 relative z-20 space-y-4 pb-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-50 bg-white rounded-3xl shadow-sm ring-1 ring-black/5">
                <p className="text-sm font-bold text-slate-500">Loading properties...</p>
              </div>
            ) : properties.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-50 bg-white rounded-3xl shadow-sm ring-1 ring-black/5 mt-4">
                <Building2 className="h-8 w-8 mb-2 text-slate-400" />
                <p className="text-sm font-bold text-slate-500">No properties found</p>
              </div>
            ) : (
              properties.map((p: any) => {
                const isApartment = p.propertyType !== 'others';
                return (
                  <div key={p.id} className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-black/5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 shadow-sm", isApartment ? "bg-primary/10 text-primary" : "bg-emerald-100 text-emerald-600")}>
                        {isApartment ? <Building2 size={20} /> : <Waves size={20} />}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <h4 className="text-sm font-black text-slate-800 truncate mb-1">{p.propertyName}</h4>
                        <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md", isApartment ? "bg-primary/5 text-primary border border-primary/10" : "bg-emerald-50 text-emerald-600 border border-emerald-100")}>
                          {isApartment ? 'Apartment' : 'Common Area'}
                        </span>
                      </div>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50 shrink-0 -mr-2 -mt-1 rounded-xl">
                            <Trash2 size={16} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl max-w-[90vw] p-6">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-black">Delete Property?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm font-medium">This will permanently remove "{p.propertyName}".</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-2 mt-4">
                            <AlertDialogCancel className="rounded-xl border-none bg-slate-100 font-bold hover:bg-slate-200">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)} className="rounded-xl bg-rose-500 font-bold text-white hover:bg-rose-600">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-50 text-xs">
                      {isApartment ? (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                              <Building size={13} /> <span className="text-slate-800 font-bold">{p.towerName || 'N/A'}</span>
                            </div>
                            <div className="flex gap-4">
                              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                <Layers size={13} /> <span className="text-slate-800 font-bold">{p.floorNo || '-'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                <DoorOpen size={13} /> <span className="text-slate-800 font-bold">{p.doorNo || '-'}</span>
                              </div>
                            </div>
                          </div>
                          {p.contactName && (
                            <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-50 border-dashed">
                              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                <User size={13} /> <span className="text-slate-700">{p.contactName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                <Phone size={13} /> <span className="text-slate-700">{p.contactMobile}</span>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {p.commonAreas && (
                            <div className="flex items-start gap-2 text-slate-500 font-medium">
                              <MapPin size={13} className="mt-0.5 shrink-0" />
                              <div className="flex flex-wrap gap-1">
                                {p.commonAreas.split(',').map((a: string) => <Badge key={a} variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-none">{a.trim()}</Badge>)}
                              </div>
                            </div>
                          )}
                          {p.address && <div className="flex items-center gap-2 text-slate-500 font-medium mt-1"><Info size={13} className="shrink-0" /><span className="truncate">{p.address}</span></div>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===== SHARED CREATE DIALOG ===== */}
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
          <DialogContent className="sm:max-w-lg rounded-3xl sm:rounded-lg max-h-[90vh] overflow-y-auto">
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
                    {t === 'apartment' ? 'Apartment' : 'Common Area'}
                  </button>
                ))}
              </div>

              {propType === 'apartment' ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><Building size={13} /> Tower Name *</Label>
                    <Input placeholder="e.g. Tower A, Block B" value={form.towerName} onChange={e => setForm(f => ({ ...f, towerName: e.target.value }))} className="rounded-xl h-11" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5"><Layers size={13} /> Floor No.</Label>
                      <Input type="number" placeholder="e.g. 5" value={form.floorNo} onChange={e => setForm(f => ({ ...f, floorNo: e.target.value }))} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5"><DoorOpen size={13} /> Door No.</Label>
                      <Input type="number" placeholder="e.g. 501" value={form.doorNo} onChange={e => setForm(f => ({ ...f, doorNo: e.target.value }))} className="rounded-xl h-11" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Contact Name</Label>
                      <Input placeholder="e.g. John Doe" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Mobile No.</Label>
                      <Input type="number" placeholder="e.g. 9876543210" value={form.contactMobile} onChange={e => setForm(f => ({ ...f, contactMobile: e.target.value }))} className="rounded-xl h-11" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Area Name *</Label>
                    <Input placeholder="e.g. Swimming Pool" value={form.areaName} onChange={e => setForm(f => ({ ...f, areaName: e.target.value }))} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Quick Add</Label>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_AREAS.map(area => (
                        <button key={area} type="button" onClick={() => setForm(f => ({ ...f, areaName: area }))}
                          className={cn('text-xs px-2.5 py-1 rounded-full border transition-all',
                            form.areaName === area ? 'bg-primary/10 border-primary/30 text-primary font-bold' : 'border-slate-200 text-slate-500 hover:border-primary hover:text-primary font-medium')}>
                          + {area}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Information</Label>
                    <Input placeholder="e.g. Open 6am–10pm, capacity 50" value={form.info} onChange={e => setForm(f => ({ ...f, info: e.target.value }))} className="rounded-xl h-11" />
                  </div>
                </>
              )}
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
              <Button disabled={!canCreate || createMutation.isPending} onClick={handleCreate} className="rounded-xl">
                {createMutation.isPending ? 'Creating...' : 'Create Property'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PropertyManagement;