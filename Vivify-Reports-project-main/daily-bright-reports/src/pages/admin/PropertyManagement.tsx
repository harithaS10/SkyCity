import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Building2, Building, Plus, Trash2, Layers, DoorOpen, Waves, Phone, User, Info, MapPin, Home, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COMMON_AREAS = ["Swimming Pool", "Club House", "Gym", "Parking", "Garden", "Terrace"];
const emptyEditForm = { towerName: "", floorNo: "", doorNo: "", contactName: "", contactMobile: "", areaName: "", info: "" };
type EditForm = typeof emptyEditForm;

const EditFormPanel = ({ type, setType, f, setF }: { type: string; setType: (t: "apartment" | "others") => void; f: EditForm; setF: React.Dispatch<React.SetStateAction<EditForm>>; }) => (
  <div className="space-y-4 py-2">
    <div className="grid grid-cols-2 gap-3">
      {(["apartment", "others"] as const).map(t => (
        <button key={t} type="button" onClick={() => setType(t)}
          className={cn("flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all text-sm font-semibold",
            type === t ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
          {t === "apartment" ? <Building2 size={20} /> : <Waves size={20} />}
          {t === "apartment" ? "Apartment / Tower" : "Common Area / Others"}
        </button>
      ))}
    </div>
    {type === "apartment" ? (
      <>
        <div className="space-y-1.5"><Label className="flex items-center gap-1.5 text-xs"><Building size={12} /> Tower Name *</Label>
          <Input placeholder="e.g. Tower A" value={f.towerName} onChange={e => setF(p => ({ ...p, towerName: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label className="flex items-center gap-1.5 text-xs"><Layers size={12} /> Floor No.</Label>
            <Input type="number" placeholder="e.g. 5" value={f.floorNo} onChange={e => setF(p => ({ ...p, floorNo: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label className="flex items-center gap-1.5 text-xs"><DoorOpen size={12} /> Door No.</Label>
            <Input type="number" placeholder="e.g. 501" value={f.doorNo} onChange={e => setF(p => ({ ...p, doorNo: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label className="text-xs">Contact Name</Label>
            <Input placeholder="e.g. John Doe" value={f.contactName} onChange={e => setF(p => ({ ...p, contactName: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Mobile No.</Label>
            <Input type="number" placeholder="e.g. 9876543210" value={f.contactMobile} onChange={e => setF(p => ({ ...p, contactMobile: e.target.value }))} /></div>
        </div>
      </>
    ) : (
      <>
        <div className="space-y-1.5"><Label className="text-xs">Area Name *</Label>
          <Input placeholder="e.g. Swimming Pool" value={f.areaName} onChange={e => setF(p => ({ ...p, areaName: e.target.value }))} /></div>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_AREAS.map(area => (
            <button key={area} type="button" onClick={() => setF(p => ({ ...p, areaName: area }))}
              className={cn("text-xs px-2 py-0.5 rounded-full border transition-all",
                f.areaName === area ? "bg-primary/10 border-primary/30 text-primary" : "border-slate-200 hover:border-primary hover:text-primary")}>
              + {area}
            </button>
          ))}
        </div>
        <div className="space-y-1.5"><Label className="text-xs">Information</Label>
          <Input placeholder="e.g. Open 6am-10pm" value={f.info} onChange={e => setF(p => ({ ...p, info: e.target.value }))} /></div>
      </>
    )}
  </div>
);

const PropertyManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [propType, setPropType] = useState<"apartment" | "others">("apartment");

  // Apartment: shared fields + list of tower names
  const [sharedFloor, setSharedFloor] = useState("");
  const [sharedDoor, setSharedDoor] = useState("");
  const [sharedContact, setSharedContact] = useState("");
  const [sharedMobile, setSharedMobile] = useState("");
  const [towerNames, setTowerNames] = useState<string[]>([""]);

  // Others: list of area entries
  const [areas, setAreas] = useState<{ areaName: string; info: string }[]>([{ areaName: "", info: "" }]);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editType, setEditType] = useState<"apartment" | "others">("apartment");
  const [editForm, setEditForm] = useState<EditForm>({ ...emptyEditForm });

  const resetCreate = () => {
    setPropType("apartment");
    setSharedFloor(""); setSharedDoor(""); setSharedContact(""); setSharedMobile("");
    setTowerNames([""]);
    setAreas([{ areaName: "", info: "" }]);
  };

  const openEdit = (p: any) => {
    setEditTarget(p);
    setEditType(p.propertyType === "others" ? "others" : "apartment");
    setEditForm({ towerName: p.towerName || "", floorNo: p.floorNo || "", doorNo: p.doorNo || "", contactName: p.contactName || "", contactMobile: p.contactMobile || "", areaName: p.propertyType === "others" ? p.propertyName : "", info: p.address || "" });
    setEditOpen(true);
  };

  const { data: res, isLoading } = useQuery({
    queryKey: ["properties", user?.associationId],
    queryFn: () => api.properties.getByAssociation(Number(user?.associationId)),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (payload: any) => (api.properties as any).bulkCreate(payload),
    onSuccess: (r: any) => { queryClient.invalidateQueries({ queryKey: ["properties"] }); toast.success(r.message || "Properties created"); setCreateOpen(false); resetCreate(); },
    onError: () => toast.error("Failed to create properties"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => (api.properties as any).update(id, { ...data, associationId: user?.associationId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["properties"] }); toast.success("Property updated"); setEditOpen(false); },
    onError: () => toast.error("Failed to update property"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.properties.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["properties"] }); toast.success("Property deleted"); },
  });

  const properties = (res?.data as any)?.items ?? res?.data ?? [];
  const apartmentCount = properties.filter((p: any) => p.propertyType !== "others").length;
  const commonAreaCount = properties.filter((p: any) => p.propertyType === "others").length;

  const handleBulkCreate = () => {
    let list: any[] = [];
    if (propType === "apartment") {
      list = towerNames.filter(n => n.trim()).map(name => ({
        propertyName: name, address: "", totalUnits: 0, propertyType: "apartment",
        towerName: name, floorNo: sharedFloor, doorNo: sharedDoor,
        contactName: sharedContact, contactMobile: sharedMobile,
        associationId: user?.associationId,
      }));
    } else {
      list = areas.filter(a => a.areaName.trim()).map(a => ({
        propertyName: a.areaName, address: a.info, totalUnits: 0, propertyType: "others",
        associationId: user?.associationId,
      }));
    }
    if (list.length === 0) { toast.error("Add at least one entry"); return; }
    bulkCreateMutation.mutate({ properties: list });
  };

  const validCount = propType === "apartment" ? towerNames.filter(n => n.trim()).length : areas.filter(a => a.areaName.trim()).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Community Infrastructure</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage properties for your association</p>
          </div>
          <Dialog open={createOpen} onOpenChange={o => { setCreateOpen(o); if (!o) resetCreate(); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus size={16} /> Add Property</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
              <DialogHeader className="shrink-0">
                <DialogTitle>Add New Property</DialogTitle>
                <DialogDescription>Shared details apply to all towers. Just add different tower names.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 shrink-0">
                {(["apartment", "others"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setPropType(t)}
                    className={cn("flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all text-sm font-semibold",
                      propType === t ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                    {t === "apartment" ? <Building2 size={20} /> : <Waves size={20} />}
                    {t === "apartment" ? "Apartment / Tower" : "Common Area / Others"}
                  </button>
                ))}
              </div>
              <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                {propType === "apartment" ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tower Name *</Label>
                      {towerNames.map((name, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                          <Input placeholder={`e.g. Tower ${String.fromCharCode(65 + i)}`} value={name} onChange={e => setTowerNames(prev => prev.map((n, idx) => idx === i ? e.target.value : n))} />
                          {i === towerNames.length - 1 ? (
                            <button type="button" onClick={() => setTowerNames(prev => [...prev, ""])} className="h-8 w-8 rounded-md border border-dashed border-primary/40 text-primary hover:bg-primary/5 flex items-center justify-center shrink-0" title="Add another tower"><Plus size={14} /></button>
                          ) : (
                            <button type="button" onClick={() => setTowerNames(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive shrink-0"><X size={14} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg bg-slate-50 border p-3 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shared Details (applies to all towers)</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5"><Label className="flex items-center gap-1.5 text-xs"><Layers size={12} /> Floor No.</Label>
                          <Input type="number" placeholder="e.g. 5" value={sharedFloor} onChange={e => setSharedFloor(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label className="flex items-center gap-1.5 text-xs"><DoorOpen size={12} /> Door No.</Label>
                          <Input type="number" placeholder="e.g. 501" value={sharedDoor} onChange={e => setSharedDoor(e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5"><Label className="text-xs">Contact Name</Label>
                          <Input placeholder="e.g. John Doe" value={sharedContact} onChange={e => setSharedContact(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Mobile No.</Label>
                          <Input type="number" placeholder="e.g. 9876543210" value={sharedMobile} onChange={e => setSharedMobile(e.target.value)} /></div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Area Names</Label>
                    {areas.map((a, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                        <Input placeholder="e.g. Swimming Pool" value={a.areaName} onChange={e => setAreas(prev => prev.map((x, idx) => idx === i ? { ...x, areaName: e.target.value } : x))} />
                        {i === areas.length - 1 ? (
                          <button type="button" onClick={() => setAreas(prev => [...prev, { areaName: "", info: "" }])} className="h-8 w-8 rounded-md border border-dashed border-emerald-400/60 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center shrink-0" title="Add another area"><Plus size={14} /></button>
                        ) : (
                          <button type="button" onClick={() => setAreas(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive shrink-0"><X size={14} /></button>
                        )}
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {COMMON_AREAS.map(area => (
                        <button key={area} type="button"
                          onClick={() => setAreas(prev => {
                            const last = prev[prev.length - 1];
                            if (!last.areaName) return prev.map((x, i) => i === prev.length - 1 ? { ...x, areaName: area } : x);
                            return [...prev, { areaName: area, info: "" }];
                          })}
                          className="text-xs px-2 py-0.5 rounded-full border border-slate-200 hover:border-primary hover:text-primary transition-all">
                          + {area}
                        </button>
                      ))}
                    </div>
                    <Input placeholder="e.g. Open 6am-10pm, capacity 50" value={areas[0]?.info || ""} onChange={e => setAreas(prev => prev.map(x => ({ ...x, info: e.target.value })))} />
                  </>
                )}
              </div>
              <DialogFooter className="shrink-0 pt-2 border-t">
                <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreate(); }}>Cancel</Button>
                <Button disabled={bulkCreateMutation.isPending || validCount === 0} onClick={handleBulkCreate}>
                  {bulkCreateMutation.isPending ? "Creating..." : `Create ${validCount} Propert${validCount === 1 ? "y" : "ies"}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="border-none shadow-sm bg-primary text-primary-foreground">
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium opacity-80">Total Properties</p><p className="text-3xl font-bold mt-1">{properties.length}</p></div><Building2 className="h-8 w-8 opacity-30" /></div></CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">Apartments / Towers</p><p className="text-3xl font-bold mt-1 text-blue-600">{apartmentCount}</p></div><Building className="h-8 w-8 text-blue-100" /></div></CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">Common Areas</p><p className="text-3xl font-bold mt-1 text-emerald-600">{commonAreaCount}</p></div><Waves className="h-8 w-8 text-emerald-100" /></div></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">All Properties</h2>
            {isLoading ? <p className="text-center py-12 text-muted-foreground">Loading...</p>
            : properties.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-xl bg-slate-50/50">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 font-medium">No properties yet.</p>
                <p className="text-slate-400 text-sm mt-1">Click "Add Property" to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {properties.map((p: any) => (
                  <Card key={p.id} className="border shadow-sm hover:shadow-md transition-all hover:border-primary/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", p.propertyType === "others" ? "bg-emerald-100" : "bg-primary/10")}>
                            {p.propertyType === "others" ? <Waves size={20} className="text-emerald-600" /> : <Building2 size={20} className="text-primary" />}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm truncate">{p.propertyName}</CardTitle>
                            <Badge variant="outline" className="text-[10px] mt-0.5">{p.propertyType === "others" ? "Common Area" : "Apartment / Tower"}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => openEdit(p)}><Pencil size={13} /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 size={13} /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Property?</AlertDialogTitle><AlertDialogDescription>This will permanently remove this property.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(p.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1.5 text-xs pt-0">
                      {p.propertyType !== "others" ? (
                        <>
                          {p.towerName && <div className="flex items-center gap-2 text-muted-foreground"><Building size={11} /><span>Tower: <span className="text-foreground font-medium">{p.towerName}</span></span></div>}
                          <div className="flex items-center gap-4">
                            {p.floorNo && <div className="flex items-center gap-1.5 text-muted-foreground"><Layers size={11} /><span>Floor <span className="text-foreground font-medium">{p.floorNo}</span></span></div>}
                            {p.doorNo && <div className="flex items-center gap-1.5 text-muted-foreground"><DoorOpen size={11} /><span>Door <span className="text-foreground font-medium">{p.doorNo}</span></span></div>}
                          </div>
                          {p.contactName && <div className="flex items-center gap-2 text-muted-foreground"><User size={11} /><span className="text-foreground font-medium">{p.contactName}</span></div>}
                          {p.contactMobile && <div className="flex items-center gap-2 text-muted-foreground"><Phone size={11} /><span className="text-foreground font-medium">{p.contactMobile}</span></div>}
                        </>
                      ) : (
                        <>
                          {p.commonAreas && <div className="flex items-start gap-2 text-muted-foreground"><MapPin size={11} className="mt-0.5 shrink-0" /><div className="flex flex-wrap gap-1">{p.commonAreas.split(",").map((a: string) => <Badge key={a} variant="secondary" className="text-[10px]">{a.trim()}</Badge>)}</div></div>}
                          {p.address && <div className="flex items-center gap-2 text-muted-foreground"><Info size={11} /><span>{p.address}</span></div>}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <Card className="border-none shadow-sm ring-1 ring-slate-200">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Guidelines</CardTitle><CardDescription className="text-xs">Setup your community hierarchy</CardDescription></CardHeader>
              <CardContent className="space-y-4 text-xs text-slate-600">
                {[
                  { icon: <Building2 size={14} className="text-primary shrink-0" />, text: "Fill shared details once — Floor, Door, Contact — then add multiple tower names." },
                  { icon: <Waves size={14} className="text-emerald-600 shrink-0" />, text: "Add multiple Common Areas like Pool, Gym, Club House at once." },
                  { icon: <User size={14} className="text-blue-500 shrink-0" />, text: "Assign a contact name and mobile number for each apartment." },
                  { icon: <Home size={14} className="text-amber-500 shrink-0" />, text: "Properties are linked to your association automatically." },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">{item.icon}</div>
                    <p className="leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm ring-1 ring-slate-200 bg-primary/5">
              <CardContent className="pt-5 pb-4 text-center space-y-3">
                <Building2 className="h-8 w-8 mx-auto text-primary opacity-60" />
                <p className="text-xs text-muted-foreground">Ready to add new properties?</p>
                <Button size="sm" className="w-full gap-2" onClick={() => setCreateOpen(true)}><Plus size={14} /> Add Property</Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Edit Property</DialogTitle><DialogDescription>Update the property details below.</DialogDescription></DialogHeader>
            <EditFormPanel type={editType} setType={setEditType} f={editForm} setF={setEditForm} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button disabled={!(editType === "apartment" ? editForm.towerName : editForm.areaName) || updateMutation.isPending}
                onClick={() => editTarget && updateMutation.mutate({ id: editTarget.id, data: { propertyName: editType === "apartment" ? editForm.towerName : editForm.areaName, address: editForm.info, totalUnits: 0, propertyType: editType, towerName: editType === "apartment" ? editForm.towerName : undefined, floorNo: editType === "apartment" ? editForm.floorNo : undefined, doorNo: editType === "apartment" ? editForm.doorNo : undefined, contactName: editType === "apartment" ? editForm.contactName : undefined, contactMobile: editType === "apartment" ? editForm.contactMobile : undefined } })}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PropertyManagement;




