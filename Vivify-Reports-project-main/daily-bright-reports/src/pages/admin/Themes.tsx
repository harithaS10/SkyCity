import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload, Palette, Building2, X, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts//AuthContext';
import defaultLogo from '@/assets/skycity-logo.png';

const PRESET_COLORS = [
  { name: 'Slate', value: '#1e293b' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Teal', value: '#0d9488' },
];

const Themes: React.FC = () => {
  const { user, updateBranding } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState(user?.associationName || '');
  const [themeColor, setThemeColor] = useState(user?.themeColor || '#1e293b');
  const [logoPreview, setLogoPreview] = useState<string | null>(user?.logoUrl || defaultLogo);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.branding.get();
        if (res.success && res.data) {
          setCompanyName(res.data.associationName || user?.associationName || '');
          setThemeColor(res.data.themeColor || user?.themeColor || '#1e293b');
          if (res.data.logoUrl) setLogoPreview(res.data.logoUrl);
          else setLogoPreview(defaultLogo);
        }
      } catch { /* use context defaults */ }
    };
    load();
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setLogoPreview(result);
      setLogoBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await api.branding.update({
        associationName: companyName || undefined,
        themeColor,
        logoUrl: logoBase64 || undefined,
      });
      if (res.success) {
        updateBranding({
          associationName: companyName,
          themeColor,
          logoUrl: logoBase64 || logoPreview || undefined,
        });
        // Apply theme color immediately
        document.documentElement.style.setProperty('--brand-primary', themeColor);
        toast.success('Branding saved successfully');
      } else {
        toast.error(res.message || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save branding');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in relative">
        {/* ===== DESKTOP VIEW ===== */}
        <div className="hidden sm:block p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Branding</h1>
            <p className="text-muted-foreground text-sm mt-1">Customize your company logo, name and colors</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Company Identity */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <CardTitle className="text-base">Company Identity</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Company Logo</Label>
                  <div className="flex items-center gap-4">
                    <div
                      className="h-24 w-24 rounded-xl border-2 border-dashed flex items-center justify-center bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-1" />
                      ) : (
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        Upload Logo
                      </Button>
                      {logoPreview && logoPreview !== defaultLogo && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive block"
                          onClick={() => { setLogoPreview(defaultLogo); setLogoBase64(null); }}>
                          <X className="h-3.5 w-3.5 mr-1.5" /> Remove
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Your company name"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Right: Colors */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Palette className="h-5 w-5 text-purple-600" />
                  </div>
                  <CardTitle className="text-base">Header & Nav Color</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-8 gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.value}
                      title={c.name}
                      className="relative h-9 w-full rounded-lg border-2 transition-all hover:scale-105"
                      style={{ backgroundColor: c.value, borderColor: themeColor === c.value ? 'white' : 'transparent', outline: themeColor === c.value ? `2px solid ${c.value}` : 'none' }}
                      onClick={() => setThemeColor(c.value)}
                    >
                      {themeColor === c.value && (
                        <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Label className="shrink-0">Custom Color</Label>
                  <div className="flex items-center gap-2 border rounded-md px-3 py-1.5">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={e => setThemeColor(e.target.value)}
                      className="h-6 w-6 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="text-sm font-mono text-muted-foreground">{themeColor}</span>
                  </div>
                </div>
                {/* Live preview */}
                <div className="rounded-xl overflow-hidden border shadow-sm">
                  <div className="h-12 flex items-center px-4 gap-3" style={{ backgroundColor: themeColor }}>
                    <div className="h-6 w-6 rounded bg-white/20" />
                    <div className="h-3 w-20 rounded bg-white/40" />
                    <div className="ml-auto flex gap-2">
                      <div className="h-3 w-12 rounded bg-white/30" />
                      <div className="h-3 w-12 rounded bg-white/30" />
                    </div>
                  </div>
                  <div className="h-20 bg-muted/20 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Page content area preview</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full lg:w-auto px-10">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Save Branding'}
          </Button>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="block sm:hidden bg-slate-50 -mx-4 -mt-4 min-h-[calc(100vh-64px)] pb-24">
          <div className="bg-primary pt-8 pb-12 px-6 rounded-b-[2.5rem] shadow-lg relative z-10 text-white">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black tracking-tight truncate">Branding</h1>
                <p className="text-[10px] text-white/70 font-bold uppercase mt-1 italic tracking-widest leading-relaxed">Customize your company logo, name and colors</p>
              </div>
            </div>
          </div>

          <div className="px-5 -mt-6 relative z-20 space-y-4">
            {/* Identity Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-black/5 flex flex-col gap-5">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-500 shadow-sm shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-black text-slate-800">Company Identity</h4>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company Logo</Label>
                  <div className="flex items-center gap-4">
                    <div
                      className="h-20 w-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50/50 cursor-pointer overflow-hidden shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-2" />
                      ) : (
                        <Upload className="h-6 w-6 text-slate-300" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" className="rounded-xl h-9 text-xs font-bold" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-3 w-3 mr-2" /> Upload Logo
                      </Button>
                      {logoPreview && logoPreview !== defaultLogo && (
                        <Button variant="ghost" className="h-8 text-xs text-rose-500 hover:bg-rose-50 rounded-xl font-bold" onClick={() => { setLogoPreview(defaultLogo); setLogoBase64(null); }}>
                          <X className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company Name</Label>
                  <Input
                    className="rounded-xl h-12 bg-slate-50/50 border-slate-200 font-medium text-base px-4"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Your company name"
                  />
                </div>
              </div>
            </div>

            {/* Colors Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-black/5 flex flex-col gap-5">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-500 shadow-sm shrink-0">
                  <Palette className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-black text-slate-800">Theme Colors</h4>
              </div>

              <div className="space-y-5">
                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Presets</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c.value}
                        title={c.name}
                        className="relative aspect-square w-full rounded-2xl border-2 transition-all shadow-sm"
                        style={{ backgroundColor: c.value, borderColor: themeColor === c.value ? 'white' : 'transparent', outline: themeColor === c.value ? `2px solid ${c.value}` : 'none' }}
                        onClick={() => setThemeColor(c.value)}
                      >
                        {themeColor === c.value && (
                          <Check className="h-6 w-6 text-white absolute inset-0 m-auto stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custom Color</Label>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={e => setThemeColor(e.target.value)}
                      className="h-10 w-14 rounded-lg cursor-pointer border-0 bg-transparent p-0 shrink-0 shadow-sm"
                    />
                    <span className="text-sm font-black text-slate-700 tracking-widest font-mono uppercase">{themeColor}</span>
                  </div>
                </div>

                {/* Live preview */}
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm mt-2">
                  <div className="h-14 flex items-center px-4 gap-3 transition-colors" style={{ backgroundColor: themeColor }}>
                    <div className="h-8 w-8 rounded-xl bg-white/20" />
                    <div className="h-3.5 w-24 rounded-full bg-white/40" />
                    <div className="ml-auto h-8 w-8 rounded-full bg-white/30" />
                  </div>
                  <div className="h-20 bg-slate-50 flex flex-col items-center justify-center gap-2">
                    <div className="h-2 w-16 bg-slate-200 rounded-full" />
                    <div className="h-2 w-24 bg-slate-200 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Floating Save Button for Mobile */}
          <div className="sticky bottom-[65px] p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 z-40 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] mt-4">
            <Button onClick={handleSave} disabled={isSaving} className="w-full h-14 rounded-2xl text-base font-black shadow-lg shadow-primary/20">
              {isSaving ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Saving...</> : 'Save Branding Changes'}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Themes;