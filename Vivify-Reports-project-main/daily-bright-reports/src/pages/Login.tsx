import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.jpg';
//console.log('API object:', api);
//console.log('API departments:', api.departments);

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager / Supervisor' },
  { value: 'user', label: 'Employee / User' },
];

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [departments, setDepartments] = useState<{ id: number; departmentName: string }[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | undefined>(undefined);
  const [loadingDepts, setLoadingDepts] = useState(false);

  // Tenant branding — loaded if ?tenant= param is in URL
  const [tenantName, setTenantName] = useState('Vivify Reports');
  const [tenantLogo, setTenantLogo] = useState<string | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tenantSlug = params.get('tenant');
    if (tenantSlug) {
      // In a real implementation fetch from /api/branding/public?tenant=slug
      // For now keep defaults
    }
  }, []);

  // Fetch departments when manager role is chosen
  useEffect(() => {
    if (selectedRole === 'manager' || selectedRole === 'user') {
      setLoadingDepts(true);
      api.departments
        .getAll()
        .then((res) => {
          if (res.success && res.data) setDepartments(res.data);
        })
        .catch(() => {
          /* silently fail — depts not mandatory on all deployments */
        })
        .finally(() => setLoadingDepts(false));
    } else {
      setDepartments([]);
      setSelectedDepartmentId(undefined);
    }
  }, [selectedRole]);

  const needsDepartment = selectedRole === 'manager' || selectedRole === 'user';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter your username and password');
      return;
    }

    const result = await login({
      username,
      password,
      role: selectedRole,
      departmentId: needsDepartment ? selectedDepartmentId : undefined,
    });

    if (result.success) {
      toast.success('Login successful!');
      sessionStorage.setItem('show_task_popup', '1');
      // Role-based redirect
      if (selectedRole === 'super_admin') {
        navigate('/super-admin/overview');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const displayLogo = tenantLogo ?? logo;
  const displayName = tenantName;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-white">
      {/* Brand Background watermark */}
      <div
        className="absolute inset-0 z-0 bg-no-repeat bg-center opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url('${displayLogo}')`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
        }}
      />

      <div className="w-full max-w-lg space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Logo + Brand Name */}
        <div className="flex flex-row items-center justify-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg p-2 ring-1 ring-slate-100">
            <img src={displayLogo} alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div className="text-left">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 uppercase">
              {displayName}
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1 tracking-wide uppercase">
              Daily Reporting System
            </p>
          </div>
        </div>

        <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-md">
          <CardHeader className="space-y-1 pb-6 pt-8">
            <CardTitle className="text-2xl font-bold text-center">
              Welcome back
            </CardTitle>
            <CardDescription className="text-center">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in zoom-in-95 duration-200">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username or Email</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="username or email@company.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 transition-all duration-200 bg-background/50 focus:bg-background"
                  disabled={isLoading}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10 transition-all duration-200 bg-background/50 focus:bg-background"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Role Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="role">Sign in as</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(v) => setSelectedRole(v as UserRole)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="role" className="h-11 bg-background/50">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department Dropdown — shown only for manager / user */}
              {needsDepartment && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="department">
                    Department{' '}
                    <span className="text-muted-foreground text-xs font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Select
                    value={selectedDepartmentId?.toString() ?? 'none'}
                    onValueChange={(v) =>
                      setSelectedDepartmentId(
                        v === 'none' ? undefined : parseInt(v, 10)
                      )
                    }
                    disabled={isLoading || loadingDepts}
                  >
                    <SelectTrigger
                      id="department"
                      className="h-11 bg-background/50"
                    >
                      <SelectValue
                        placeholder={
                          loadingDepts ? 'Loading...' : 'Select department'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      <SelectItem value="none">— No Department —</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id.toString()}>
                          {d.departmentName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold transition-all duration-300 active:scale-[0.98] shadow-lg shadow-primary/20"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center mt-8">
          <p className="text-sm text-muted-foreground">
            © 2026 {displayName}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
