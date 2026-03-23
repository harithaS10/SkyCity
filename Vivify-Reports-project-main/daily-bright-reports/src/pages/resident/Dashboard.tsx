import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  ClipboardList, 
  Receipt, 
  Bell, 
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const ResidentDashboard = () => {
  const { user } = useAuth();
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['residentStats', user?.id],
    queryFn: () => api.dashboard.getResidentStats(Number(user?.id))
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const complaints = stats?.data?.complaints || [];
  const latestBill = stats?.data?.latestBill;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name}</h1>
          <p className="text-muted-foreground mt-1">
            Monitoring your residence at Unit {user?.unitId}
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95">
          <PlusCircle className="mr-2 h-4 w-4" /> New Complaint
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-none bg-gradient-to-br from-blue-500/10 to-indigo-500/10 shadow-sm border border-blue-100 dark:border-blue-900/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Complaints</CardTitle>
            <ClipboardList className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {complaints.find((c: any) => c.status === 'Open' || c.status === 'Assigned')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pending resolution</p>
          </CardContent>
        </Card>

        <Card className="border-none bg-gradient-to-br from-green-500/10 to-emerald-500/10 shadow-sm border border-green-100 dark:border-green-900/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Latest Bill</CardTitle>
            <Receipt className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {latestBill ? `₹${latestBill.totalAmount}` : 'No bills'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Due: {latestBill ? new Date(latestBill.dueDate).toLocaleDateString() : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none bg-gradient-to-br from-purple-500/10 to-pink-500/10 shadow-sm border border-purple-100 dark:border-purple-900/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Notifications</CardTitle>
            <Bell className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3</div>
            <p className="text-xs text-muted-foreground mt-1">Unread alerts</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-md border-none ring-1 ring-slate-200 dark:ring-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Complaints</CardTitle>
            <Button variant="ghost" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {complaints.length > 0 ? (
                complaints.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 group hover:ring-1 hover:ring-primary/20 transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        c.status === 'Resolved' ? 'bg-green-100 text-green-600' :
                        c.status === 'Open' ? 'bg-orange-100 text-orange-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {c.status === 'Resolved' ? <CheckCircle2 size={16} /> :
                         c.status === 'Open' ? <AlertCircle size={16} /> :
                         <Clock size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{c.category || 'Maintenance'}</p>
                        <p className="text-xs text-muted-foreground">Status: {c.status}</p>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">{c.count} items</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground italic">
                  No recent complaints found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-none ring-1 ring-slate-200 dark:ring-slate-800">
          <CardHeader>
            <CardTitle>Community Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg">
                <h4 className="font-semibold text-sm">Scheduled Maintenance</h4>
                <p className="text-xs text-muted-foreground mt-1">Generator service tomorrow between 10 AM - 12 PM.</p>
              </div>
              <div className="p-4 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 rounded-r-lg">
                <h4 className="font-semibold text-sm">Water Supply Notice</h4>
                <p className="text-xs text-muted-foreground mt-1">Pumping motor repair in Building B. Supply limited for 2 hours.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResidentDashboard;
