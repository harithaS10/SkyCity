import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Save, FileText, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';

export default function TermsManagement() {
  const [terms, setTerms] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTerms = async () => {
    setIsLoading(true);
    try {
      const response = await api.terms.get();
      if (response.success && response.data) {
        setTerms(response.data);
      }
    } catch (error) {
      console.error('Error fetching terms:', error);
      toast.error('Failed to load terms and conditions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await api.terms.update(terms);
      if (response.success) {
        toast.success('Terms and conditions updated successfully.');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Error saving terms:', error);
      toast.error('Failed to save terms and conditions.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete the Terms & Conditions? This will clear the content completely.")) {
      setTerms('');
      setIsSaving(true);
      try {
        const response = await api.terms.update('');
        if (response.success) {
          toast.success('Terms and conditions deleted successfully.');
        } else {
          throw new Error('Failed to delete');
        }
      } catch (error) {
        console.error('Error deleting terms:', error);
        toast.error('Failed to delete terms and conditions.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden sm:block space-y-6 pb-24">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-3">
                <FileText className="h-7 w-7 text-primary" />
                Terms & Conditions
              </h1>
              <p className="text-muted-foreground font-medium">Manage the terms and conditions that users must accept upon login.</p>
            </div>
          </div>

          <Card className="overflow-hidden border-none shadow-md">
            <CardHeader className="bg-white pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    Edit Terms Content
                  </CardTitle>
                  <CardDescription>
                    Users will be required to check a box agreeing to these terms before they can log in.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <div className="space-y-4">
                <Textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Enter terms and conditions here..."
                  className="min-h-[450px] font-mono text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors p-4 rounded-xl"
                  disabled={isLoading}
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    onClick={handleDelete} 
                    disabled={isLoading || isSaving || !terms}
                    className="text-destructive hover:bg-destructive/10 border-destructive/20"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={isLoading || isSaving || !terms.trim()}
                    className="px-8 shadow-lg shadow-primary/20"
                  >
                    {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="block sm:hidden bg-slate-50 -mx-4 -mt-4 min-h-screen">
          {/* Curved Header */}
          <div className="bg-primary pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black tracking-tight truncate">Terms & Conditions</h1>
                <p className="text-[10px] text-white/70 font-bold uppercase mt-1 italic tracking-widest leading-relaxed">
                  Manage the terms that users must accept upon login
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl h-11 w-11 flex items-center justify-center shrink-0 border border-white/10">
                <FileText className="h-5 w-5 text-white" />
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <div className="h-8 w-8 rounded-xl bg-emerald-400/20 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Status</p>
                <p className="text-sm font-bold">{terms ? 'Content Published' : 'No Content'}</p>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="px-5 -mt-6 relative z-20 space-y-4 pb-12">
            <Card className="bg-white rounded-[2rem] shadow-xl border-none overflow-hidden ring-1 ring-black/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-black text-slate-800">Edit Content</CardTitle>
                <CardDescription className="text-[11px] font-medium leading-normal">
                  Write the terms and conditions in the editor below. Changes apply instantly after saving.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Enter terms and conditions here..."
                  className="min-h-[350px] font-mono text-xs bg-slate-50 border-none rounded-2xl focus:bg-slate-50/50 p-4 ring-1 ring-slate-100"
                  disabled={isLoading}
                />
                
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button 
                    variant="ghost" 
                    onClick={handleDelete} 
                    disabled={isLoading || isSaving || !terms}
                    className="h-12 rounded-2xl bg-rose-50 text-rose-600 font-black text-[11px] uppercase tracking-widest hover:bg-rose-100"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={isLoading || isSaving || !terms.trim()}
                    className="h-12 rounded-2xl bg-primary text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20"
                  >
                    {isSaving ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-4 border border-white flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <RefreshCw className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                Staff members will see these terms the next time they log into the portal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

