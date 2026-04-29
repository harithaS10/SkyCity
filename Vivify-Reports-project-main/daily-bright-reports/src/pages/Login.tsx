import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Eye, EyeOff, AlertCircle, Building2, Shield, BarChart3, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import logo from '@/assets/skycity-logo.png';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, logout, isLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole] = useState<UserRole>('user');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [hideTerms, setHideTerms] = useState(false);
  const [loginBgColor, setLoginBgColor] = useState<string>('');

  // Fetch public branding to apply theme color on login page (before auth)
  useEffect(() => {
    const loadPublicBranding = async () => {
      try {
        const res = await api.branding.getPublic();
        if (res.success && res.data?.themeColor) {
          const color = res.data.themeColor;
          setLoginBgColor(color);
          // Apply to CSS variables so bg-primary works
          const hexToHsl = (hex: string) => {
            const clean = hex.replace('#', '');
            const full = clean.length === 3 ? clean.split('').map((c: string) => c + c).join('') : clean;
            const r2 = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full);
            if (!r2) return null;
            let r = parseInt(r2[1], 16) / 255, g = parseInt(r2[2], 16) / 255, b = parseInt(r2[3], 16) / 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h = 0, s = 0; const l = (max + min) / 2;
            if (max !== min) {
              const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
              switch (max) { case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break; case g: h = ((b - r) / d + 2) / 6; break; case b: h = ((r - g) / d + 4) / 6; break; }
            }
            return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
          };
          const hsl = hexToHsl(color);
          if (hsl) {
            document.documentElement.style.setProperty('--primary', hsl);
            document.documentElement.style.setProperty('--ring', hsl);
          }
          document.documentElement.style.setProperty('--brand-primary', color);
          // Cache for next load
          try { localStorage.setItem('skycity_theme_color', color); } catch { /* ignore */ }
        }
      } catch { /* use default teal */ }
    };
    loadPublicBranding();
  }, []);

  useEffect(() => {
    const loadTerms = async () => {
      try {
        const res = await api.terms.get();
        if (res.success && res.data) {
          setTermsContent(res.data);
        }
      } catch (err) {
        console.error('Failed to load terms');
      }
    };
    loadTerms();
  }, []);

  // Check if terms should be hidden for this user
  useEffect(() => {
    const checkUserTerms = async () => {
      if (!username || username.length < 3) {
        setHideTerms(false);
        return;
      }
      try {
        const res = await api.auth.checkTerms(username);
        if (res.success && res.hasAcceptedTerms) {
          setHideTerms(true);
        } else {
          setHideTerms(false);
        }
      } catch (err) {
        setHideTerms(false);
      }
    };

    const timer = setTimeout(checkUserTerms, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please enter your username and password');
      return;
    }
    const result = await login({ username, password, acceptTerms: acceptedTerms });
    if (result.success && result.user) {
      // Only staff are required to accept terms and conditions
      if (result.user.role === 'staff' && !result.user.hasAcceptedTerms && !acceptedTerms) {
        logout();
        setError('Staff members must accept the terms and conditions to log in.');
        return;
      }

      toast.success('Login successful!');
      sessionStorage.setItem('show_task_popup', '1');
      if (result.user.role === 'super_admin') {
        navigate('/super-admin/overview');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const features = [
    { icon: BarChart3, title: 'Daily Reports', desc: 'Track and manage daily work allocations' },
    { icon: Building2, title: 'Property Management', desc: 'Oversee properties, buildings and units' },
    { icon: Shield, title: 'Complaint Handling', desc: 'Resolve resident complaints efficiently' },
    { icon: Users, title: 'Team Collaboration', desc: 'Coordinate staff tasks and assignments' },
  ];

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Panel */}
      <div
        className="hidden lg:flex lg:w-3/5 flex-col justify-between p-8 relative overflow-hidden h-full"
        style={{
          background: loginBgColor
            ? `linear-gradient(135deg, ${loginBgColor} 0%, ${loginBgColor}dd 60%, ${loginBgColor}bb 100%)`
            : `linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.9) 60%, hsl(var(--primary) / 0.8) 100%)`
        }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-300 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-300 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-violet-200 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center p-2 ring-1 ring-white/20">
            <img src={logo} alt="SkyCity" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-white font-black text-2xl tracking-tighter lowercase skycity-logo-text">SkyCity</h1>
            <p className="text-white/70 text-[10px] tracking-widest uppercase reports-subtext font-bold">Reports Platform</p>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white leading-tight">
              Manage your site<br />
              <span className="text-white/80">smarter, faster.</span>
            </h2>
            <p className="text-white/75 text-sm leading-relaxed max-w-sm">
              A unified platform for property management, complaint resolution, and daily workforce reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
                <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{title}</p>
                  <p className="text-white/65 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/50 text-xs">© 2026 SkyCity. All rights reserved.</p>
        </div>
      </div>

      {/* Right Panel (Main Login Area) */}
      <div className="w-full lg:w-2/5 flex lg:items-center items-start justify-center bg-slate-50 dark:bg-slate-950 relative overflow-y-auto py-4 lg:py-0 px-3 min-h-screen">
        {/* Decorative background elements for mobile */}
        <div className="lg:hidden absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
        </div>

        <div className="w-full max-w-md relative z-10 my-auto lg:my-0">
          <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] shadow-2xl shadow-black/5 border border-white dark:border-slate-800 overflow-hidden">
            <div className="p-4 sm:p-10 space-y-3 lg:space-y-6">
              
              {/* Mobile Branding - Tightened for maximum compactness */}
              <div className="lg:hidden flex flex-col items-center justify-center text-center space-y-2 pt-1 mb-2">
                <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center p-2 ring-1 ring-slate-100 shadow-sm">
                  <img src={logo} alt="SkyCity" className="h-full w-full object-contain" />
                </div>
                <div className="space-y-0">
                  <h1 className="font-black text-xl tracking-tighter text-primary lowercase skycity-logo-text leading-none">SkyCity</h1>
                  <p className="text-primary/50 text-[8px] tracking-[0.2em] uppercase reports-subtext font-bold">Reports Platform</p>
                </div>
              </div>

              {/* Heading - HIDDEN ON MOBILE */}
              <div className="hidden lg:block space-y-1 text-center sm:text-left">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">Welcome back</h2>
                <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">Sign in to your account</p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5">
                {error && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold animate-shake">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-0.5 sm:space-y-1.5">
                  <Label htmlFor="username" className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-10 sm:h-12 rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all text-xs sm:text-sm font-medium"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-0.5 sm:space-y-1.5">
                  <Label htmlFor="password" className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 sm:h-12 pr-11 rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all text-xs sm:text-sm font-medium"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors p-2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {!hideTerms && (
                  <div className="flex items-start gap-2.5 mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <Checkbox 
                      id="terms" 
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                      className="mt-0.5 rounded-md h-3.5 w-3.5"
                    />
                    <div className="text-[10px] leading-tight flex-1">
                      <label htmlFor="terms" className="font-bold text-slate-500 cursor-pointer">I agree to the </label>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button type="button" className="text-primary hover:underline font-black focus:outline-none text-left">Terms and Conditions</button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border-none">
                          <DialogHeader><DialogTitle className="text-xl font-black">Terms and Conditions</DialogTitle></DialogHeader>
                          <div className="whitespace-pre-wrap text-sm text-slate-500 mt-4 leading-relaxed">{termsContent || 'Loading terms...'}</div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 sm:h-12 mt-1 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs sm:text-sm uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {isLoading ? <><LoadingSpinner size="sm" /><span>Wait...</span></> : 'Sign In'}
                </button>
              </form>

              <div className="flex items-center gap-2 my-2 sm:my-4">
                <div className="flex-1 h-[1px] bg-slate-50" />
                <span className="text-[8px] font-black tracking-widest text-slate-200 uppercase">Secure</span>
                <div className="flex-1 h-[1px] bg-slate-50" />
              </div>

              <p className="text-center text-[8px] text-slate-300 font-bold uppercase tracking-tight">
                © 2026 SkyCity.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;