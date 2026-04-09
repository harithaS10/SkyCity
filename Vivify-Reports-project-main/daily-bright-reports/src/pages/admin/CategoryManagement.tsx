import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Loader2, Package, Calendar, Hash, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Category { id: number; categoryName: string; createdAt: string; isActive: boolean; productCount: number; }
interface SubCategory { id: number; categoryId: number; categoryName: string; subCategoryName: string; description?: string; createdAt: string; isActive: boolean; productCount: number; }

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubLoading, setIsSubLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Category form
  const [categoryName, setCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isEditCatOpen, setIsEditCatOpen] = useState(false);
  const [editCategoryName, setEditCategoryName] = useState('');

  // SubCategory form
  const [subForm, setSubForm] = useState({ categoryId: '', subCategoryName: '', description: '' });
  const [editingSub, setEditingSub] = useState<SubCategory | null>(null);
  const [isEditSubOpen, setIsEditSubOpen] = useState(false);
  const [editSubForm, setEditSubForm] = useState({ categoryId: '', subCategoryName: '', description: '' });

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await api.categories.getAll();
      if (res.success && res.data) setCategories(res.data);
    } catch { toast.error('Failed to load categories'); }
    finally { setIsLoading(false); }
  };

  const fetchSubCategories = async () => {
    setIsSubLoading(true);
    try {
      const res = await api.subCategories.getAll();
      if (res.success && res.data) setSubCategories(res.data);
    } catch { toast.error('Failed to load sub-categories'); }
    finally { setIsSubLoading(false); }
  };

  useEffect(() => { fetchCategories(); fetchSubCategories(); }, []);

  // ── Category CRUD ──────────────────────────────────────────────────────────
  const handleAddCategory = async () => {
    if (!categoryName.trim()) return toast.error('Please enter a category name');
    setIsSubmitting(true);
    try {
      const res = await api.categories.create({ categoryName: categoryName.trim() });
      if (res.success) { toast.success('Category added'); setCategoryName(''); fetchCategories(); }
      else toast.error(res.message || 'Failed to add category');
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSubmitting(false); }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await api.categories.update(editingCategory.id, { categoryName: editCategoryName.trim() });
      if (res.success) { toast.success('Category updated'); setIsEditCatOpen(false); fetchCategories(); }
      else toast.error(res.message || 'Failed to update');
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (cat.productCount > 0) return toast.error(`Cannot delete — has ${cat.productCount} product(s)`);
    if (!confirm(`Delete category "${cat.categoryName}"?`)) return;
    try {
      const res = await api.categories.delete(cat.id);
      if (res.success) { toast.success('Category deleted'); fetchCategories(); fetchSubCategories(); }
      else toast.error(res.message || 'Failed to delete');
    } catch (e: any) { toast.error(e.message); }
  };

  // ── SubCategory CRUD ───────────────────────────────────────────────────────
  const handleAddSubCategory = async () => {
    if (!subForm.categoryId || !subForm.subCategoryName.trim()) return toast.error('Please fill required fields');
    setIsSubmitting(true);
    try {
      const res = await api.subCategories.create({
        categoryId: parseInt(subForm.categoryId),
        subCategoryName: subForm.subCategoryName.trim(),
        description: subForm.description.trim() || undefined
      });
      if (res.success) {
        toast.success('Sub-category added');
        setSubForm({ categoryId: '', subCategoryName: '', description: '' });
        fetchSubCategories();
      } else toast.error(res.message || 'Failed to add sub-category');
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSubmitting(false); }
  };

  const handleUpdateSubCategory = async () => {
    if (!editingSub || !editSubForm.subCategoryName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await api.subCategories.update(editingSub.id, {
        categoryId: parseInt(editSubForm.categoryId),
        subCategoryName: editSubForm.subCategoryName.trim(),
        description: editSubForm.description.trim() || undefined
      });
      if (res.success) { toast.success('Sub-category updated'); setIsEditSubOpen(false); fetchSubCategories(); }
      else toast.error(res.message || 'Failed to update');
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteSubCategory = async (sub: SubCategory) => {
    if (sub.productCount > 0) return toast.error(`Cannot delete — has ${sub.productCount} product(s)`);
    if (!confirm(`Delete sub-category "${sub.subCategoryName}"?`)) return;
    try {
      const res = await api.subCategories.delete(sub.id);
      if (res.success) { toast.success('Sub-category deleted'); fetchSubCategories(); }
      else toast.error(res.message || 'Failed to delete');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Category Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage categories and sub-categories for your products.</p>
        </div>

        <Tabs defaultValue="categories">
          <TabsList>
            <TabsTrigger value="categories" className="gap-2"><Package className="h-4 w-4" />Categories</TabsTrigger>
            <TabsTrigger value="subcategories" className="gap-2"><Layers className="h-4 w-4" />Sub Categories</TabsTrigger>
          </TabsList>

          {/* ── CATEGORIES TAB ── */}
          <TabsContent value="categories" className="space-y-6 mt-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Add New Category</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label htmlFor="categoryName">Category Name</Label>
                    <Input id="categoryName" placeholder="e.g. CCTV, Access Control" value={categoryName}
                      onChange={e => setCategoryName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddCategory()} className="mt-1" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddCategory} disabled={!categoryName.trim() || isSubmitting} className="gap-2">
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Add Category
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Categories ({categories.length})</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50">
                    <Package className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    <p className="text-muted-foreground">No categories yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16"><Hash className="h-4 w-4 inline mr-1" />S.No</TableHead>
                        <TableHead>Category Name</TableHead>
                        <TableHead className="text-center">Products</TableHead>
                        <TableHead><Calendar className="h-4 w-4 inline mr-1" />Created</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((cat, i) => (
                        <TableRow key={cat.id}>
                          <TableCell className="text-slate-600">{i + 1}</TableCell>
                          <TableCell className="font-medium">{cat.categoryName}</TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{cat.productCount}</span>
                          </TableCell>
                          <TableCell className="text-slate-600">{format(new Date(cat.createdAt), 'dd-MM-yyyy')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="outline" size="sm" className="gap-1" onClick={() => { setEditingCategory(cat); setEditCategoryName(cat.categoryName); setIsEditCatOpen(true); }}>
                                <Edit className="h-3 w-3" />Edit
                              </Button>
                              <Button variant="outline" size="sm" className="gap-1 text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteCategory(cat)} disabled={cat.productCount > 0}>
                                <Trash2 className="h-3 w-3" />Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SUB CATEGORIES TAB ── */}
          <TabsContent value="subcategories" className="space-y-6 mt-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Add New Sub Category</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {categories.length === 0 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    Please create categories first before adding sub-categories.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select value={subForm.categoryId} onValueChange={v => setSubForm(p => ({ ...p, categoryId: v }))} disabled={categories.length === 0}>
                      <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.categoryName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sub Category Name *</Label>
                    <Input placeholder="e.g. HD, IP, Biometric" value={subForm.subCategoryName}
                      onChange={e => setSubForm(p => ({ ...p, subCategoryName: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Textarea placeholder="Brief description..." value={subForm.description}
                    onChange={e => setSubForm(p => ({ ...p, description: e.target.value }))} rows={2} />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleAddSubCategory} disabled={!subForm.categoryId || !subForm.subCategoryName.trim() || isSubmitting} className="gap-2">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add Sub Category
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />Sub Categories ({subCategories.length})</CardTitle></CardHeader>
              <CardContent>
                {isSubLoading ? (
                  <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : subCategories.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50">
                    <Layers className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    <p className="text-muted-foreground">No sub-categories yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">S.No</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Sub Category Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center">Products</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subCategories.map((sub, i) => (
                        <TableRow key={sub.id}>
                          <TableCell className="text-slate-600">{i + 1}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{sub.categoryName}</span>
                          </TableCell>
                          <TableCell className="font-medium">{sub.subCategoryName}</TableCell>
                          <TableCell className="text-slate-500 max-w-xs truncate">{sub.description || '-'}</TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">{sub.productCount}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                                setEditingSub(sub);
                                setEditSubForm({ categoryId: sub.categoryId.toString(), subCategoryName: sub.subCategoryName, description: sub.description || '' });
                                setIsEditSubOpen(true);
                              }}>
                                <Edit className="h-3 w-3" />Edit
                              </Button>
                              <Button variant="outline" size="sm" className="gap-1 text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteSubCategory(sub)} disabled={sub.productCount > 0}>
                                <Trash2 className="h-3 w-3" />Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Category Dialog */}
      <Dialog open={isEditCatOpen} onOpenChange={setIsEditCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Category</DialogTitle><DialogDescription>Update the category name.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Category Name</Label>
              <Input value={editCategoryName} onChange={e => setEditCategoryName(e.target.value)} placeholder="Category name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCatOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleUpdateCategory} disabled={!editCategoryName.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit SubCategory Dialog */}
      <Dialog open={isEditSubOpen} onOpenChange={setIsEditSubOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Sub Category</DialogTitle><DialogDescription>Update sub-category details.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Category *</Label>
              <Select value={editSubForm.categoryId} onValueChange={v => setEditSubForm(p => ({ ...p, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.categoryName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Sub Category Name *</Label>
              <Input value={editSubForm.subCategoryName} onChange={e => setEditSubForm(p => ({ ...p, subCategoryName: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea value={editSubForm.description} onChange={e => setEditSubForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditSubOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleUpdateSubCategory} disabled={!editSubForm.subCategoryName.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CategoryManagement;
