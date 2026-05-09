import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Activity, Search, Clock, Layers } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

interface ActivityEntry {
  id: number;
  userId: number;
  userName: string;
  action: string;
  details?: string;
  createdAt: string;
}

const ActivityLogs: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.departmentId) { setIsLoading(false); return; }
    // Fetch work allocation / task activity for dept users as a proxy for activity logs
    api.allocations.getAll()
      .then(res => {
        if (res.success && res.data) {
          const entries: ActivityEntry[] = (res.data as any[]).map((a, i) => ({
            id: a.id ?? i,
            userId: a.assignedTo ?? 0,
            userName: a.assignedToName ?? a.userName ?? 'Unknown',
            action: `Task "${a.title ?? a.workTitle ?? 'Work'}"`,
            details: `Status: ${a.status ?? '—'}`,
            createdAt: a.updatedAt ?? a.createdAt ?? new Date().toISOString(),
          }));
          setLogs(entries);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user]);

  const filtered = logs.filter(l =>
    l.userName.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase())
  );

  const STATUS_COLOR: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    in_progress: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pt-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
            <Activity className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Activity Logs</h1>
            <p className="text-muted-foreground text-sm">Read-only activity feed for your department</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-50 border border-violet-200 text-violet-800 text-sm">
          <Layers className="h-4 w-4 flex-shrink-0" />
          <span>This is a <strong>read-only</strong> view. No data can be modified from this page.</span>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100/50"><Activity className="h-5 w-5 text-violet-600" /></div>
            <div><p className="text-2xl font-bold">{logs.length}</p><p className="text-sm text-muted-foreground">Total Activities</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100/50"><Clock className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold">{logs.filter(l => l.details?.includes('in')).length}</p>
              <p className="text-sm text-muted-foreground">In-Progress Tasks</p>
            </div>
          </CardContent></Card>
        </div>

        {/* Activity Feed */}
        <Card className="border-none shadow-md">
          <CardHeader className="bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg">Activity Feed</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-10 text-muted-foreground">Loading activities...</div>
            ) : !user?.departmentId ? (
              <div className="text-center py-10 text-muted-foreground">You are not assigned to a department.</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No activities found.</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(entry => {
                  const statusKey = (entry.details ?? '').replace('Status: ', '').toLowerCase().replace(' ', '_');
                  const statusClass = STATUS_COLOR[statusKey] ?? 'bg-slate-100 text-slate-600';
                  return (
                    <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-slate-50/50 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 shrink-0 mt-0.5">
                        <Activity className="h-4 w-4 text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{entry.userName}</p>
                          <span className="text-muted-foreground text-xs">→</span>
                          <p className="text-sm text-muted-foreground truncate">{entry.action}</p>
                        </div>
                        {entry.details && (
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${statusClass}`}>
                            {entry.details}
                          </span>
                        )}
                      </div>
                      <time className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(parseISO(entry.createdAt), { addSuffix: true })}
                      </time>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ActivityLogs;
