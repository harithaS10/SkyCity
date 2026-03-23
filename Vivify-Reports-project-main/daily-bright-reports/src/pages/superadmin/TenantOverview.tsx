import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, AdminTenant } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Globe, Users, FileText, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TenantOverview: React.FC = () => {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.superAdmin.getAllAdmins()
      .then(res => { if (res.success && res.data) setTenants(res.data); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const totalUsers = tenants.reduce((s, t) => s + (t.userCount ?? 0), 0);
  const totalReports = tenants.reduce((s, t) => s + (t.reportCount ?? 0), 0);
  const activeTenants = tenants.filter(t => t.status === 'active').length;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
            <Crown className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tenant Overview</h1>
            <p className="text-muted-foreground text-sm">Global platform statistics across all admin tenants</p>
          </div>
        </div>

        {/* Global Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Tenants', value: tenants.length, icon: <Globe className="h-5 w-5 text-primary" />, color: 'bg-primary/10' },
            { label: 'Active Tenants', value: activeTenants, icon: <TrendingUp className="h-5 w-5 text-emerald-600" />, color: 'bg-emerald-100/50' },
            { label: 'Total Users', value: totalUsers, icon: <Users className="h-5 w-5 text-sky-600" />, color: 'bg-sky-100/50' },
            { label: 'Reports Filed', value: totalReports, icon: <FileText className="h-5 w-5 text-violet-600" />, color: 'bg-violet-100/50' },
          ].map(({ label, value, icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>{icon}</div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '—' : value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tenant Cards Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-4">All Tenants</h2>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-12">Loading tenants...</p>
          ) : tenants.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              No tenants found. <button onClick={() => navigate('/super-admin/admins')} className="text-primary underline ml-1">Create the first admin.</button>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tenants.map(t => (
                <Card key={t.id} className="hover:shadow-md transition-shadow cursor-pointer border" onClick={() => navigate('/super-admin/admins')}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold text-sm shadow"
                          style={{ backgroundColor: t.themeColor || '#6366f1' }}
                        >
                          {t.companyName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <CardTitle className="text-base">{t.companyName}</CardTitle>
                          <p className="text-xs text-muted-foreground">{t.email}</p>
                        </div>
                      </div>
                      <Badge variant={t.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                        {t.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="rounded-lg bg-slate-50 p-2 text-center">
                        <p className="text-lg font-bold">{t.userCount ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground">Users</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 text-center">
                        <p className="text-lg font-bold">{t.reportCount ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground">Reports</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TenantOverview;
