import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Eye, EyeOff, AlertCircle, Building2, Shield, BarChart3, Users } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/skycity-logo.png';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole] = useState('user');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please enter your username and password');
      return;
    }
    const result = await login({ username, password });
    if (result.success) {
      toast.success('Login successful!');
      sessionStorage.setItem('show_task_popup', '1');
      if (selectedRole === 'super_admin') {
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
      <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex-col justify-between p-8 relative overflow-hidden h-full">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
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
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
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
                  <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-slate-500 text-xs">© 2026 SkyCity. All rights reserved.</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-2/5 flex items-center justify-center bg-white dark:bg-slate-950 relative overflow-hidden py-8">
        {/* Watermark logo - removed */}
        <div className="w-full max-w-md space-y-8 px-4 relative z-10 bg-white rounded-2xl shadow-xl p-8">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 justify-center">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center p-1.5">
              <img src={logo} alt="SkyCity" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="font-black text-2xl tracking-tighter text-primary lowercase skycity-logo-text">SkyCity</h1>
              <p className="text-primary/60 text-[9px] tracking-widest uppercase reports-subtext font-bold">Reports Platform</p>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Sign in to your account to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Username or Email
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 transition-colors text-sm"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-12 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 transition-colors text-sm"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all duration-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
            <span className="text-xs text-slate-400">SECURE LOGIN</span>
            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
          </div>

          <p className="text-center text-xs text-slate-400">
            Protected by enterprise-grade security. Your data is safe.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;