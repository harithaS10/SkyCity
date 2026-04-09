import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
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
        workTitle: selectedWork.workTitle
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold">Work Management</h1>
            <p className="text-muted-foreground">Manage predefined work types and codes</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 hover-lift bg-gradient-to-r from-primary to-primary/80">
                <Plus className="h-4 w-4" />
                Add Work Type
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card animate-scale-in">
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
                      className="pl-9"
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
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Work Type *</Label>
                  <Select
                    value={newWork.workType}
                    onValueChange={(value) => setNewWork((prev) => ({ ...prev, workType: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Special">Special</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateWork} disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create Work Type'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-card animate-scale-in">
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
                      className="pl-9 bg-muted"
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
                      className="pl-9"
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
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Special">Special</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditWork}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default WorkManagement;
