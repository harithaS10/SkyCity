import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getImageUrl } from '@/utils/imageUtils';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  Package,
  Calendar,
  Hash,
  Upload,
  Image as ImageIcon,
  X,
  Search,
  Filter
} from "lucide-react";
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Category {
  id: number;
  categoryName: string;
  createdAt: string;
  isActive: boolean;
  productCount: number;
}

interface SubCategory {
  id: number;
  categoryId: number;
  categoryName: string;
  subCategoryName: string;
  description?: string;
}

interface Product {
  id: number;
  categoryId: number;
  categoryName: string;
  subCategoryId?: number;
  subCategoryName?: string;
  productName: string;
  price: number;
  description?: string;
  imageUrl?: string;
  createdAt: string;
  isActive: boolean;
}

const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [filteredSubCats, setFilteredSubCats] = useState<SubCategory[]>([]);
  const [editFilteredSubCats, setEditFilteredSubCats] = useState<SubCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  
  // Form states
  const [formData, setFormData] = useState({
    categoryId: '',
    subCategoryId: '',
    productName: '',
    price: '',
    description: '',
    imageUrl: ''
  });
  const [imagePreview, setImagePreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    categoryId: '',
    subCategoryId: '',
    productName: '',
    price: '',
    description: '',
    imageUrl: ''
  });
  const [editImagePreview, setEditImagePreview] = useState<string>('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [productsRes, categoriesRes, subCatsRes] = await Promise.all([
        api.products.getAll({ 
          categoryId: selectedCategoryFilter && selectedCategoryFilter !== "all" ? parseInt(selectedCategoryFilter) : undefined,
          search: searchQuery || undefined 
        }),
        api.categories.getAll(),
        api.subCategories.getAll()
      ]);

      if (productsRes.success && productsRes.data) setProducts(productsRes.data);
      else toast.error(productsRes.message || "Failed to load products");
      
      if (categoriesRes.success && categoriesRes.data) setCategories(categoriesRes.data);
      if (subCatsRes.success && subCatsRes.data) setSubCategories(subCatsRes.data);
    } catch (error: any) {
      toast.error("Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCategoryFilter, searchQuery]);

  // Filter subcategories when category changes in add form
  useEffect(() => {
    if (formData.categoryId) {
      setFilteredSubCats(subCategories.filter(sc => sc.categoryId === parseInt(formData.categoryId)));
      setFormData(p => ({ ...p, subCategoryId: '' }));
    } else {
      setFilteredSubCats([]);
    }
  }, [formData.categoryId, subCategories]);

  // Filter subcategories when category changes in edit form
  useEffect(() => {
    if (editFormData.categoryId) {
      setEditFilteredSubCats(subCategories.filter(sc => sc.categoryId === parseInt(editFormData.categoryId)));
    } else {
      setEditFilteredSubCats([]);
    }
  }, [editFormData.categoryId, subCategories]);

  const handleImageUpload = async (file: File, isEdit = false) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPG, PNG, GIF, and WebP files are allowed.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const response = await api.products.uploadImage(file);
      if (response.success && response.data) {
        const imageUrl = response.data;
        
        if (isEdit) {
          setEditFormData(prev => ({ ...prev, imageUrl }));
          setEditImagePreview(imageUrl);
        } else {
          setFormData(prev => ({ ...prev, imageUrl }));
          setImagePreview(imageUrl);
        }
        
        toast.success('Image uploaded successfully');
      } else {
        toast.error(response.message || 'Failed to upload image');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!formData.categoryId || !formData.productName.trim() || !formData.price) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate categoryId is not empty or invalid
    if (!formData.categoryId || formData.categoryId === "no-categories") {
      toast.error("Please select a valid category");
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.products.create({
        categoryId: parseInt(formData.categoryId),
        subCategoryId: formData.subCategoryId ? parseInt(formData.subCategoryId) : undefined,
        productName: formData.productName.trim(),
        price: price,
        description: formData.description.trim() || undefined,
        imageUrl: formData.imageUrl || undefined
      });

      if (response.success) {
        toast.success("Product added successfully");
        setFormData({
          categoryId: '',
          subCategoryId: '',
          productName: '',
          price: '',
          description: '',
          imageUrl: ''
        });
        setImagePreview('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        fetchData();
      } else {
        toast.error(response.message || "Failed to add product");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setEditFormData({
      categoryId: product.categoryId.toString(),
      subCategoryId: product.subCategoryId?.toString() || '',
      productName: product.productName,
      price: product.price.toString(),
      description: product.description || '',
      imageUrl: product.imageUrl || ''
    });
    setEditImagePreview(product.imageUrl || '');
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = async () => {
    if (!editFormData.categoryId || !editFormData.productName.trim() || !editFormData.price) {
      toast.error("Please fill in all required fields");
      return;
    }

    const price = parseFloat(editFormData.price);
    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.products.update(editingProduct!.id, {
        categoryId: parseInt(editFormData.categoryId),
        subCategoryId: editFormData.subCategoryId ? parseInt(editFormData.subCategoryId) : 0,
        productName: editFormData.productName.trim(),
        price: price,
        description: editFormData.description.trim() || undefined,
        imageUrl: editFormData.imageUrl || undefined
      });

      if (response.success) {
        toast.success("Product updated successfully");
        setIsEditDialogOpen(false);
        setEditingProduct(null);
        fetchData();
      } else {
        toast.error(response.message || "Failed to update product");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.productName}"?`)) {
      return;
    }

    try {
      const response = await api.products.delete(product.id);
      if (response.success) {
        toast.success("Product deleted successfully");
        fetchData();
      } else {
        toast.error(response.message || "Failed to delete product");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pt-2">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Product Management</h1>
            <p className="text-sm text-muted-foreground max-w-[500px]">
              Manage your product catalog. Add products with images, organize by categories, and track inventory.
            </p>
          </div>
        </div>

        {/* Add Product Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Product
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categories.length === 0 && !isLoading && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  No categories available. Please create categories first before adding products.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.categoryId || ""}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value || undefined }))}
                  disabled={categories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length > 0 ? (
                      categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.categoryName}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-categories" disabled>
                        No categories available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subCategory">Sub Category</Label>
                <Select
                  value={formData.subCategoryId || "none"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, subCategoryId: value === "none" ? "" : value }))}
                  disabled={!formData.categoryId || filteredSubCats.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!formData.categoryId ? "Select category first" : filteredSubCats.length === 0 ? "No sub-categories" : "Select Sub Category"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {filteredSubCats.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id.toString()}>{sc.subCategoryName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productName">Product Name *</Label>
                <Input
                  id="productName"
                  placeholder="Enter product name"
                  value={formData.productName}
                  onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter price"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">Product Image</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    className="flex-1"
                  />
                  {isUploading && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
                </div>
                {imagePreview && (
                  <div className="relative w-20 h-20 border rounded-lg overflow-hidden">
                    <img
                      src={getImageUrl(imagePreview)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => {
                        setImagePreview('');
                        setFormData(prev => ({ ...prev, imageUrl: '' }));
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter product description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleAddProduct}
                disabled={!formData.categoryId || !formData.productName.trim() || !formData.price || isSubmitting || categories.length === 0 || formData.categoryId === "no-categories"}
                className="gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Product
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Select
                  value={selectedCategoryFilter}
                  onValueChange={setSelectedCategoryFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.length > 0 ? (
                      categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.categoryName}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-categories" disabled>
                        No categories available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Products ({products.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50">
                <Package className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p className="text-muted-foreground">No products found</p>
                <p className="text-sm text-slate-400 mt-1">Add your first product to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">
                        <div className="flex items-center gap-1">
                          <Hash className="h-4 w-4" />
                          S.No
                        </div>
                      </TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Sub Category</TableHead>
                      <TableHead className="w-20">Image</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product, index) => (
                      <TableRow key={product.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-slate-600">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {product.categoryName}
                          </span>
                        </TableCell>
                        <TableCell>
                          {product.subCategoryName ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {product.subCategoryName}
                            </span>
                          ) : <span className="text-slate-400 text-xs">-</span>}
                        </TableCell>
                        <TableCell>
                          {product.imageUrl ? (
                            <img
                              src={getImageUrl(product.imageUrl)}
                              alt={product.productName}
                              className="w-12 h-12 object-cover rounded-lg border"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-slate-100 rounded-lg border flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-slate-400" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">
                            {product.productName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPrice(product.price)}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate text-slate-600">
                            {product.description || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditProduct(product)}
                              className="gap-1"
                            >
                              <Edit className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteProduct(product)}
                              className="gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
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
      </div>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update product information and details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editCategory">Category *</Label>
                <Select
                  value={editFormData.categoryId || ""}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, categoryId: value || undefined }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length > 0 ? (
                      categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.categoryName}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-categories" disabled>
                        No categories available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sub Category</Label>
                <Select
                  value={editFormData.subCategoryId || "none"}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, subCategoryId: value === "none" ? "" : value }))}
                  disabled={!editFormData.categoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!editFormData.categoryId ? "Select category first" : "Select Sub Category"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {editFilteredSubCats.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id.toString()}>{sc.subCategoryName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editProductName">Product Name *</Label>
                <Input
                  id="editProductName"
                  placeholder="Enter product name"
                  value={editFormData.productName}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, productName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPrice">Price *</Label>
                <Input
                  id="editPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter price"
                  value={editFormData.price}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editImage">Product Image</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, true);
                  }}
                />
                {editImagePreview && (
                  <div className="relative w-20 h-20 border rounded-lg overflow-hidden">
                    <img
                      src={getImageUrl(editImagePreview)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => {
                        setEditImagePreview('');
                        setEditFormData(prev => ({ ...prev, imageUrl: '' }));
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                placeholder="Enter product description"
                value={editFormData.description}
                onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateProduct}
              disabled={!editFormData.categoryId || !editFormData.productName.trim() || !editFormData.price || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Update Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ProductManagement;