import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Briefcase,
  Plus,
  Search,
  Pencil,
  Trash2,
  Hash,
  FileText,
  Tag,
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

const WorkManagement: React.FC = () => {
  const [works, setWorks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWork, setSelectedWork] = useState<any | null>(null);
  const [newWork, setNewWork] = useState({ workCode: '', workTitle: '', workType: 'Standard' });

  const [isCreating, setIsCreating] = useState(false);

  const fetchWorks = async () => {
    setIsLoading(true);
    try {
      const response = await api.works.getAll();
      if (response.success && response.data) {
        setWorks(response.data);
      }
    } catch (error) {
      console.error("Error fetching works:", error);
      toast.error("Failed to load work types");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorks();
  }, []);

  const filteredWorks = works.filter(
    (work) =>
      work.workTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      work.workCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateWork = async () => {
    if (!newWork.workCode || !newWork.workTitle) {
      toast.error('Please fill in all fields');
      return;
    }
    setIsCreating(true);
    try {
      const response = await api.works.create(newWork);
      if (response.success) {
        toast.success('Work type created successfully');
        setWorks(prev => [...prev, response.data]);
        setNewWork({ workCode: '', workTitle: '', workType: 'Standard' });
        setIsCreateDialogOpen(false);
      } else {
        toast.error(response.message || "Failed to create work type");
      }
    } catch (error: any) {
      toast.error(error.message || "Error creating work type");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditWork = async () => {
    if (!selectedWork || !selectedWork.workCode || !selectedWork.workTitle) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const response = await api.works.update(selectedWork.id, {
        workCode: selectedWork.workCode,
        workTitle: selectedWork.workTitle,
        workType: selectedWork.workType || 'Standard'
      });
      if (response.success) {
        toast.success('Work type updated successfully');
        setSelectedWork(null);
        setIsEditDialogOpen(false);
        fetchWorks();
      } else {
        toast.error(response.message || "Failed to update");
      }
    } catch (error: any) {
      toast.error(error.message || "Error updating work type");
    }
  };

  const handleDeleteWork = async (id: number) => {
    try {
      const response = await api.works.delete(id);
      if (response.success) {
        toast.success('Work type deleted successfully');
        fetchWorks();
      } else {
        toast.error(response.message || "Failed to delete");
      }
    } catch (error: any) {
      toast.error(error.message || "Error deleting work type");
    }
  };

  const openEditDialog = (work: any) => {
    setSelectedWork({ ...work });
    setIsEditDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        
        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden sm:block space-y-6 mb-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
            <div>
              <h1 className="text-2xl font-bold">Work Management</h1>
              <p className="text-muted-foreground">Manage predefined work types and codes</p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2 hover-lift bg-gradient-to-r from-primary to-primary/80">
              <Plus className="h-4 w-4" />
              Add Work Type
            </Button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <Card className="hover-lift transition-all duration-300">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{works.length}</p>
                  <p className="text-sm text-muted-foreground">Total Work Types</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-lift transition-all duration-300">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-success/20 to-success/10">
                  <Hash className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{works.filter(w => w.workCode.startsWith('0')).length}</p>
                  <p className="text-sm text-muted-foreground">Standard Works</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-lift transition-all duration-300">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-warning/20 to-warning/10">
                  <FileText className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{works.filter(w => !w.workCode.startsWith('0')).length}</p>
                  <p className="text-sm text-muted-foreground">Special Works</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Works Table */}
          <Card className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-lg">Work Types</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search works..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="border-x">
                  <TableHeader className="bg-primary hover:bg-primary">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-white font-semibold last:border-r-0 h-11">Code</TableHead>
                      <TableHead className="text-white font-semibold last:border-r-0 h-11">Title</TableHead>
                      <TableHead className="text-white font-semibold last:border-r-0 h-11">Type</TableHead>
                      <TableHead className="text-right text-white font-semibold px-4 h-11">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorks.map((work, index) => (
                      <TableRow
                        key={work.id}
                        className="animate-fade-in hover:bg-slate-50/50 transition-colors border-b border-slate-100"
                        style={{ animationDelay: `${index * 0.03}s` }}
                      >
                        <TableCell className="border-r border-slate-200 last:border-r-0">
                          <Badge variant="outline" className="font-mono bg-primary/10 text-primary border-primary/20">
                            {work.workCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium border-r border-slate-200 last:border-r-0">{work.workTitle}</TableCell>
                        <TableCell className="border-r border-slate-200 last:border-r-0">
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            {work.workType || 'Standard'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(work)}
                              className="hover:text-primary hover:bg-primary/10"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Work Type?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete "{work.workTitle}" ({work.workCode}). This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteWork(work.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
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
            </CardContent>
          </Card>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="block sm:hidden bg-slate-50 -mx-4 -mt-4 min-h-screen">
          <div className="bg-primary pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black tracking-tight truncate">Works</h1>
                <p className="text-[10px] text-white/70 font-bold uppercase mt-1 italic tracking-widest leading-relaxed">Work Management</p>
              </div>
              <Button variant="ghost" className="bg-white/10 text-white rounded-2xl h-11 w-11 p-0 shrink-0 backdrop-blur-md border-0" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-6 w-6" />
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10 text-center">
                <p className="text-xl font-black">{works.length}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70 mt-1">Total</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10 text-center">
                <p className="text-xl font-black">{works.filter(w => w.workCode.startsWith('0')).length}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70 mt-1">Standard</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10 text-center">
                <p className="text-xl font-black">{works.filter(w => !w.workCode.startsWith('0')).length}</p>
                <p className="text-[9px] uppercase font-bold tracking-widest opacity-70 mt-1">Special</p>
              </div>
            </div>
          </div>

          <div className="px-5 -mt-6 relative z-20 space-y-4 pb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search works..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-12 pr-4 rounded-2xl bg-white border-none shadow-xl ring-1 ring-black/5 font-bold text-sm"
              />
            </div>

            <div className="space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50 bg-white rounded-3xl shadow-sm ring-1 ring-black/5">
                  <p className="text-sm font-bold text-slate-500">Loading works...</p>
                </div>
              ) : filteredWorks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50 bg-white rounded-3xl shadow-sm ring-1 ring-black/5">
                  <Briefcase className="h-8 w-8 mb-2 text-slate-400" />
                  <p className="text-sm font-bold text-slate-500">No works found</p>
                </div>
              ) : (
                filteredWorks.map((work) => {
                  return (
                    <div key={work.id} className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-black/5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 text-primary shadow-sm shrink-0">
                          <Briefcase className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <h4 className="text-sm font-black text-slate-800 truncate mb-1">{work.workTitle}</h4>
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                            Code: {work.workCode}
                          </span>
                        </div>
                        <div className="flex gap-1 shrink-0 -mr-2 -mt-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl" onClick={() => openEditDialog(work)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl max-w-[90vw] p-6">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-black">Delete Work Type?</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm font-medium">This will permanently remove "{work.workTitle}".</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2 mt-4">
                                <AlertDialogCancel className="rounded-xl border-none bg-slate-100 font-bold hover:bg-slate-200">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteWork(work.id)} className="rounded-xl bg-rose-500 font-bold text-white hover:bg-rose-600">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
                        <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl", work.workType === 'Special' ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
                          {work.workType || 'Standard'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ===== SHARED CREATE DIALOG ===== */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="bg-card animate-scale-in sm:max-w-lg rounded-3xl sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>Create New Work Type</DialogTitle>
              <DialogDescription>
                Add a new predefined work type with a unique code.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Work Code *</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="code"
                    placeholder="e.g., D01, E02"
                    value={newWork.workCode}
                    onChange={(e) => setNewWork((prev) => ({ ...prev, workCode: e.target.value.toUpperCase() }))}
                    className="pl-9 rounded-xl h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Work Title *</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="title"
                    placeholder="e.g., Data Entry"
                    value={newWork.workTitle}
                    onChange={(e) => setNewWork((prev) => ({ ...prev, workTitle: e.target.value }))}
                    className="pl-9 rounded-xl h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Work Type *</Label>
                <Select
                  value={newWork.workType}
                  onValueChange={(value) => setNewWork((prev) => ({ ...prev, workType: value }))}
                >
                  <SelectTrigger className="w-full rounded-xl h-11">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Special">Special</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleCreateWork} disabled={isCreating} className="rounded-xl">
                {isCreating ? 'Creating...' : 'Create Work Type'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== SHARED EDIT DIALOG ===== */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-card animate-scale-in sm:max-w-lg rounded-3xl sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>Edit Work Type</DialogTitle>
              <DialogDescription>
                Update the work type details.
              </DialogDescription>
            </DialogHeader>
            {selectedWork && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Work Code</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-code"
                      value={selectedWork.workCode}
                      disabled
                      className="pl-9 bg-muted rounded-xl h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Work Title *</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-title"
                      value={selectedWork.workTitle}
                      onChange={(e) =>
                        setSelectedWork((prev: any) => prev ? { ...prev, workTitle: e.target.value } : null)
                      }
                      className="pl-9 rounded-xl h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Work Type *</Label>
                  <Select
                    value={selectedWork.workType || 'Standard'}
                    onValueChange={(value) =>
                      setSelectedWork((prev: any) => prev ? { ...prev, workType: value } : null)
                    }
                  >
                    <SelectTrigger className="w-full rounded-xl h-11">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Special">Special</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleEditWork} className="rounded-xl">Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default WorkManagement;
