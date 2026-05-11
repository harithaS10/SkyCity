import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Users,
  TrendingUp,
  Calendar,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  X,
  ArrowRight,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

type TimeRange = 'week' | 'month' | 'year' | 'custom';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--accent))', 'hsl(var(--destructive))'];

const safeFormatDate = (dateStr: string | null | undefined, formatStr: string = 'MMM dd, yyyy') => {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), formatStr);
  } catch (e) {
    return 'Invalid Date';
  }
};

const Analytics: React.FC = () => {
  const { user, canExport, hasPermission, isLoading: authLoading } = useAuth();
  const canView = user?.role === 'staff' ? hasPermission('analytics', 'view') : true;
  const navigate = useNavigate();

  // Redirect if no permission (but only after auth is loaded)
  React.useEffect(() => {
    if (!authLoading && !canView) {
      navigate('/dashboard');
    }
  }, [canView, authLoading, navigate]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [customStartDate, setCustomStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [users, setUsers] = useState<any[]>([]);
  const [availableWorks, setAvailableWorks] = useState<any[]>([]);
  const [workSearchQuery, setWorkSearchQuery] = useState('');
  const [selectedWorks, setSelectedWorks] = useState<string[]>([]);
  const [isWorkFilterOpen, setIsWorkFilterOpen] = useState(false);
  const [isMobileWorkFilterOpen, setIsMobileWorkFilterOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, worksRes, clientsRes] = await Promise.all([
          api.users.getAll(),
          api.works.getAll(),
          api.clients.getAll()
        ]);
        if (usersRes.success && usersRes.data) setUsers(usersRes.data.map((u: any) => ({ ...u, name: u.fullName })));
        if (worksRes.success && worksRes.data) setAvailableWorks(worksRes.data);
        if (clientsRes.success && clientsRes.data) {
          const map: Record<string, string> = {};
          clientsRes.data.forEach((c: any) => { map[c.id.toString()] = c.name; });
          setClientsMap(map);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchAnalytics = async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      try {
        const params: any = {};
        if (selectedUser !== 'all') params.userId = selectedUser;
        if (selectedWorks.length > 0) params.workTitles = selectedWorks.join(',');
        const now = new Date();
        if (timeRange === 'week') {
          params.startDate = format(startOfWeek(now), 'yyyy-MM-dd');
          params.endDate = format(endOfWeek(now), 'yyyy-MM-dd');
        } else if (timeRange === 'month') {
          params.startDate = format(startOfMonth(now), 'yyyy-MM-dd');
          params.endDate = format(endOfMonth(now), 'yyyy-MM-dd');
        } else if (timeRange === 'year') {
          params.startDate = format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd');
          params.endDate = format(new Date(now.getFullYear(), 11, 31), 'yyyy-MM-dd');
        } else if (timeRange === 'custom') {
          params.startDate = customStartDate;
          params.endDate = customEndDate;
        }
        const [analyticsRes, reportsRes] = await Promise.all([
          api.admin.getAnalytics(params),
          api.admin.getAllReports(params)
        ]);
        if (!controller.signal.aborted) {
          if (analyticsRes.success && analyticsRes.data) setAnalyticsData(analyticsRes.data);
          if (reportsRes.success) setReports(reportsRes.data || []);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Error fetching analytics:", error);
          if (showLoading) toast.error("Failed to load analytics");
        }
      } finally {
        if (!controller.signal.aborted && showLoading) setIsLoading(false);
      }
    };
    fetchAnalytics(true);
    const intervalId = setInterval(() => { fetchAnalytics(false); }, 30000);
    return () => { controller.abort(); clearInterval(intervalId); };
  }, [selectedUser, timeRange, selectedWorks, customStartDate, customEndDate]);

  const filteredReports = (() => {
    let result = reports || [];
    if (selectedUser !== 'all') {
      result = result.filter(report => (report.userId || report.UserId || report.userid)?.toString() === selectedUser);
    }
    if (selectedWorks.length > 0) {
      result = result.filter(report => report.entries?.some((e: any) => selectedWorks.includes(e.workTitle || e.WorkTitle || report.workTitle || report.title || '')));
    }
    return result;
  })();

  const trendData = (() => {
    if (!analyticsData) return [];
    const rawTrend = analyticsData.type === 'comparison' ? (analyticsData.trendData || []) : (analyticsData.data || []);
    return rawTrend.filter((item: any) => item && item.date).map((item: any) => ({
      date: safeFormatDate(item.date, timeRange === 'year' ? 'MMM' : 'MMM dd'),
      entries: item.workCount || 0
    }));
  })();

  const employeeStats = users.map(user => {
    const userReports = filteredReports.filter(r => r.userId === user.id);
    const totalEntries = userReports.reduce((acc, r) => acc + (r.entries?.length || 0), 0);
    let completedCount = 0;
    let pendingCount = 0;
    userReports.forEach(report => {
      if (report.entries) {
        report.entries.forEach((entry: any) => {
          if (entry.status && entry.status === 'pending') pendingCount++;
          else completedCount++;
        });
      }
    });
    return { name: user.name.split(' ')[0], completed: completedCount, pending: pendingCount, total: totalEntries };
  }).filter(stat => stat.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);

  const workTypeDistribution = (() => {
    const counts: Record<string, number> = {};
    filteredReports.forEach((report) => {
      if (report?.entries) {
        report.entries.forEach((entry: any) => {
          const type = entry.workTitle || entry.WorkTitle || 'Other';
          counts[type] = (counts[type] || 0) + 1;
        });
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  })();

  const handleExport = async (formatType: 'excel' | 'csv') => {
    if (filteredReports.length === 0) { toast.info("No data available to export."); return; }
    try {
      const rows: any[] = [];
      filteredReports.forEach(report => {
        report.entries?.forEach((entry: any) => {
          rows.push({
            'Date': safeFormatDate(report.date || report.Date),
            'Username': report.userName || 'Unknown',
            'Work': entry.workTitle || 'N/A',
            'Status': entry.status === 'pending' ? 'Pending' : 'Completed',
            'Company': entry.newClientName || (entry.clientId ? clientsMap[entry.clientId.toString()] : 'N/A'),
            'Description': entry.description || 'N/A'
          });
        });
      });
      const fileName = `reports-export-${new Date().toISOString().split('T')[0]}.${formatType === 'excel' ? 'xlsx' : 'csv'}`;
      let fileContent: any;
      if (formatType === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");
        fileContent = Capacitor.isNativePlatform() ? XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' }) : new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      } else {
        const headers = Object.keys(rows[0]);
        const csvText = [headers.join(','), ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
        fileContent = csvText;
      }
      if (Capacitor.isNativePlatform()) {
        const savedFile = await Filesystem.writeFile({ path: fileName, data: fileContent, directory: Directory.Cache });
        await Share.share({ title: 'Export Reports', url: savedFile.uri });
      } else {
        const url = formatType === 'excel' ? window.URL.createObjectURL(fileContent as Blob) : window.URL.createObjectURL(new Blob([fileContent], { type: 'text/csv' }));
        const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
      }
      toast.success('Export successful');
    } catch (error) { toast.error('Export failed'); }
  };

  const handleWhatsAppExport = async () => {
    if (filteredReports.length === 0) { toast.info("No data available to export."); return; }
    try {
      const rows: any[] = [];
      filteredReports.forEach(report => {
        report.entries?.forEach((entry: any) => {
          rows.push({
            'Date': safeFormatDate(report.date || report.Date),
            'Username': report.userName || 'Unknown',
            'Work': entry.workTitle || 'N/A',
            'Status': entry.status === 'pending' ? 'Pending' : 'Completed'
          });
        });
      });
      const fileName = `analytics-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");
      if (Capacitor.isNativePlatform()) {
        const fileContent = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        const savedFile = await Filesystem.writeFile({ path: fileName, data: fileContent, directory: Directory.Cache });
        await Share.share({ title: 'Analytics Report', url: savedFile.uri });
      } else {
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
        const waText = encodeURIComponent('Analytics Report Attached');
        toast.success('File ready!', { action: { label: 'WhatsApp', onClick: () => window.open(`https://wa.me/?text=${waText}`, '_blank') } });
      }
    } catch (error) { toast.error('WhatsApp export failed'); }
  };

  const totalReports = filteredReports.length;
  const totalEntries = filteredReports.reduce((sum, r) => sum + (r.entries?.length || 0), 0);
  const avgEntriesPerReport = totalReports > 0 ? (totalEntries / totalReports).toFixed(1) : 0;

  return (
    <DashboardLayout>
      <div className="w-full">
        {/* Use CSS-based responsiveness for smoothness, but keep separate states for filters */}
        <div className="hidden lg:block space-y-8 animate-in fade-in duration-500 pt-6">
          {/* Desktop Content exactly as before */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-primary">Analytics Dashboard</h1>
              <p className="text-muted-foreground font-medium">Monitor performance and report distribution</p>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-[200px] bg-card">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">All Employees</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Popover open={isWorkFilterOpen} onOpenChange={setIsWorkFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-card gap-2"><Filter className="h-4 w-4" />Work Types ({selectedWorks.length})</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-4 border-b">
                    <div className="flex justify-between mb-2"><p className="font-semibold text-sm">Filter Work</p>{selectedWorks.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSelectedWorks([])}>Clear</Button>}</div>
                    <Input placeholder="Search..." className="h-9" value={workSearchQuery} onChange={e => setWorkSearchQuery(e.target.value)} />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-2">{availableWorks.filter(w => w.workTitle.toLowerCase().includes(workSearchQuery.toLowerCase())).map(work => (
                    <div key={work.id} className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer" onClick={() => setSelectedWorks(prev => prev.includes(work.workTitle) ? prev.filter(t => t !== work.workTitle) : [...prev, work.workTitle])}>
                      <Checkbox checked={selectedWorks.includes(work.workTitle)} /><label className="text-sm cursor-pointer truncate flex-1">{work.workTitle}</label>
                    </div>
                  ))}</div>
                </PopoverContent>
              </Popover>

              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger className="w-[160px] bg-card"><Calendar className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="week">This Week</SelectItem><SelectItem value="month">This Month</SelectItem><SelectItem value="year">Full Year</SelectItem><SelectItem value="custom">Custom Range</SelectItem></SelectContent>
              </Select>

              {timeRange === 'custom' && (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                  <Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-[150px] bg-card" />
                  <span className="text-muted-foreground">to</span>
                  <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-[150px] bg-card" />
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold" disabled={!canExport}><Download className="h-4 w-4" />Export Data</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('excel')}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('csv')}><FileText className="mr-2 h-4 w-4" />CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-none shadow-md"><CardContent className="p-6 flex justify-between items-center"><div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Coverage</p><p className="text-3xl font-black">{users.length} Users</p></div><div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Users className="h-6 w-6" /></div></CardContent></Card>
            <Card className="border-none shadow-md"><CardContent className="p-6 flex justify-between items-center"><div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Active Reports</p><p className="text-3xl font-black">{totalReports}</p></div><div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500"><FileText className="h-6 w-6" /></div></CardContent></Card>
            <Card className="border-none shadow-md"><CardContent className="p-6 flex justify-between items-center"><div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Work Items</p><p className="text-3xl font-black">{totalEntries}</p></div><div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500"><TrendingUp className="h-6 w-6" /></div></CardContent></Card>
            <Card className="border-none shadow-md"><CardContent className="p-6 flex justify-between items-center"><div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Avg Tasks</p><p className="text-3xl font-black">{avgEntriesPerReport}</p></div><div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500"><BarChart3 className="h-6 w-6" /></div></CardContent></Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="border-none shadow-lg"><CardHeader><CardTitle>Productivity Breakdown</CardTitle></CardHeader><CardContent><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={employeeStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={12}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.4} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 600 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 12 }} dx={-10} /><Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: '12px', border: 'none' }} /><Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" /><Bar dataKey="completed" name="Done" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} /><Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={32} /></BarChart></ResponsiveContainer></div></CardContent></Card>
            <Card className="border-none shadow-lg"><CardHeader><CardTitle>Work Distribution</CardTitle></CardHeader><CardContent><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={workTypeDistribution} cx="50%" cy="50%" innerRadius={80} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent, x, y }) => percent < 0.05 ? null : <text x={x} y={y} fill="#1f2937" fontSize={11} fontWeight={600} textAnchor="middle" dominantBaseline="central">{`${name.slice(0, 12)} ${(percent * 100).toFixed(0)}%`}</text>}>{workTypeDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: '12px' }} /></PieChart></ResponsiveContainer></div></CardContent></Card>
          </div>

          <Card className="border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-muted/30"><CardTitle>Submission Trend</CardTitle></CardHeader>
            <CardContent className="pt-6"><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} /><Tooltip contentStyle={{ borderRadius: '12px' }} /><Line type="monotone" dataKey="entries" stroke="hsl(var(--primary))" strokeWidth={4} dot={{ fill: 'hsl(var(--primary))', r: 5, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} /></LineChart></ResponsiveContainer></div></CardContent>
          </Card>

          <Card className="border-none shadow-xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b"><CardTitle>Detailed Records</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-primary hover:bg-primary"><TableRow className="hover:bg-transparent border-none"><TableHead className="text-white italic">Employee</TableHead><TableHead className="text-white">Date</TableHead><TableHead className="text-white text-center">Entries</TableHead><TableHead className="text-white">Overview</TableHead><TableHead className="text-right text-white px-4">Status</TableHead></TableRow></TableHeader>
                <TableBody>{filteredReports.slice(0, 50).map((report) => (
                  <TableRow key={report.id} className="transition-colors group hover:bg-slate-50/50 cursor-pointer" onClick={() => setSelectedReport(report)}>
                    <TableCell className="font-bold border-r"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center border font-normal">{report.userName?.charAt(0)}</div>{report.userName}</div></TableCell>
                    <TableCell className="font-medium text-muted-foreground border-r">{safeFormatDate(report.date || report.Date)}</TableCell>
                    <TableCell className="text-center border-r"><Badge variant="outline">{report.entries?.length || 0}</Badge></TableCell>
                    <TableCell className="max-w-[300px] border-r truncate italic">{(report.entries || []).map((e: any) => e.workTitle).join(', ')}</TableCell>
                    <TableCell className="text-right border-r">{report.entries?.some((e: any) => e.status === 'pending') ? <Badge className="bg-warning/10 text-warning border-none">Pending</Badge> : <Badge className="bg-emerald-500/10 text-emerald-500 border-none">Done</Badge>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* ===== MOBILE VIEW ===== */}
        <div className="block lg:hidden min-h-screen bg-slate-50 dark:bg-slate-950 pb-[100px] -mx-4 -mt-4 animate-in fade-in duration-300">
          <div className="bg-primary pt-10 pb-16 px-6 rounded-b-[3rem] shadow-xl relative z-10 text-white">
            <div className="flex justify-between items-center mb-6">
              <div><h1 className="text-2xl font-black text-white tracking-tight">Analytics</h1><p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em]">Performance Insights</p></div>
              <Button onClick={handleWhatsAppExport} className="bg-white/20 text-white rounded-xl h-11 px-4 border-none backdrop-blur-md" size="sm" disabled={!canExport}><Download className="h-4 w-4 mr-2" /><span className="text-[11px] font-black uppercase">Export</span></Button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10"><span className="text-[8px] font-black uppercase text-white/50 block mb-1">Users</span><p className="text-xl font-black">{users.length}</p></div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10"><span className="text-[8px] font-black uppercase text-white/50 block mb-1">Reports</span><p className="text-xl font-black">{totalReports}</p></div>
            </div>
          </div>

          <div className="px-4 -mt-5 relative z-20 space-y-4">
            <div className="bg-white dark:bg-card rounded-[2rem] p-5 shadow-2xl ring-1 ring-black/5 flex items-center justify-between gap-4">
              <div className="flex-1"><span className="text-[9px] font-black uppercase text-amber-500 block mb-1">Tasks</span><p className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">{totalEntries}</p></div>
              <div className="w-px h-10 bg-slate-100 dark:bg-slate-800 shrink-0" />
              <div className="flex-1"><span className="text-[9px] font-black uppercase text-primary block mb-1">Avg/Day</span><p className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">{avgEntriesPerReport}</p></div>
            </div>

            <div className="bg-white dark:bg-card rounded-[1.5rem] p-4 shadow-xl ring-1 ring-black/5 space-y-3">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2"><Filter className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-black uppercase text-slate-400">Filters</span></div>
                 {timeRange === 'custom' && <span className="text-[8px] font-black text-primary px-2 py-0.5 bg-primary/5 rounded-md">Custom Range Active</span>}
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 font-bold text-xs">
                    <Users className="h-3.5 w-3.5 mr-2 text-primary" />
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-60 overflow-y-auto w-[var(--radix-select-trigger-width)] rounded-xl">
                    <SelectItem value="all" className="text-xs font-bold">All Employees</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id.toString()} className="text-xs font-bold">{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-2">
                  <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 font-bold text-[10px]">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 text-primary" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" side="bottom" className="rounded-xl">
                      <SelectItem value="week">Week</SelectItem><SelectItem value="month">Month</SelectItem><SelectItem value="year">Year</SelectItem><SelectItem value="custom">Range</SelectItem>
                    </SelectContent>
                  </Select>

                  <Popover open={isMobileWorkFilterOpen} onOpenChange={setIsMobileWorkFilterOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-10 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 font-bold text-[10px] gap-1.5 justify-start">
                        <BarChart3 className="h-3.5 w-3.5 text-primary" />
                        <span className="truncate">Types ({selectedWorks.length})</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[92vw] p-0 rounded-2xl shadow-2xl border-none ring-1 ring-black/5" side="bottom" sideOffset={8}>
                      <div className="p-3 bg-slate-50 border-b">
                        <div className="flex justify-between mb-2"><p className="font-black text-[9px] uppercase text-slate-500">Categories</p>{selectedWorks.length > 0 && <button className="text-[9px] font-black text-primary" onClick={() => setSelectedWorks([])}>Clear</button>}</div>
                        <Input placeholder="Search..." className="h-8 text-xs rounded-lg bg-white border-none ring-1 ring-slate-200" value={workSearchQuery} onChange={e => setWorkSearchQuery(e.target.value)} />
                      </div>
                      <div className="max-h-48 overflow-y-auto p-2">{availableWorks.filter(w => w.workTitle.toLowerCase().includes(workSearchQuery.toLowerCase())).map(work => (
                        <div key={work.id} className="flex items-center gap-2 p-2.5 rounded-lg active:bg-slate-50" onClick={() => setSelectedWorks(prev => prev.includes(work.workTitle) ? prev.filter(t => t !== work.workTitle) : [...prev, work.workTitle])}>
                          <Checkbox checked={selectedWorks.includes(work.workTitle)} className="h-3.5 w-3.5" /><label className="text-[11px] font-bold text-slate-700 truncate flex-1">{work.workTitle}</label>
                        </div>
                      ))}</div>
                    </PopoverContent>
                  </Popover>
                </div>

                {timeRange === 'custom' && (
                  <div className="flex gap-2 pt-1">
                    <Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="h-9 rounded-lg bg-slate-50 border-none ring-1 ring-slate-100 text-[10px] font-bold" />
                    <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="h-9 rounded-lg bg-slate-50 border-none ring-1 ring-slate-100 text-[10px] font-bold" />
                  </div>
                )}
              </div>
            </div>

            <Card className="border-none shadow-lg rounded-[1.5rem] overflow-hidden">
               <CardHeader className="p-4 pb-0"><CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Productivity</CardTitle></CardHeader>
               <CardContent className="p-2"><div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={employeeStats} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 8 }} /><Tooltip contentStyle={{ borderRadius: '12px', fontSize: '10px' }} /><Bar dataKey="completed" fill="#10b981" radius={[3, 3, 0, 0]} barSize={10} /><Bar dataKey="pending" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={10} /></BarChart></ResponsiveContainer></div></CardContent>
            </Card>

            <div className="space-y-3 pb-10">
              <div className="flex justify-between items-center px-2"><h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Detailed Logs</h3><span className="text-[9px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full">{filteredReports.length}</span></div>
              <div className="space-y-2.5">{filteredReports.slice(0, 15).map((report) => (
                <div key={report.id} onClick={() => setSelectedReport(report)} className="bg-white dark:bg-card rounded-[1.25rem] p-4 shadow-sm ring-1 ring-black/5 active:scale-[0.98] transition-all flex items-center justify-between">
                   <div className="flex items-center gap-3 min-w-0">
                     <div className="h-9 w-9 rounded-full bg-slate-50 flex items-center justify-center font-black text-primary text-[11px] shrink-0">{report.userName?.charAt(0)}</div>
                     <div className="min-w-0">
                       <h4 className="text-[11px] font-black text-slate-800 truncate">{report.userName}</h4>
                       <p className="text-[9px] font-bold text-slate-400">{safeFormatDate(report.date || report.Date)}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-2 shrink-0">
                     <Badge variant="outline" className={cn("text-[8px] px-2 py-0.5 font-black uppercase border-0 rounded-md", report.entries?.some((e: any) => e.status === 'pending') ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600")}>
                        {report.entries?.some((e: any) => e.status === 'pending') ? 'Pending' : 'Done'}
                     </Badge>
                     <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                   </div>
                </div>
              ))}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Detail Modal - Compact & Premium */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => setSelectedReport(null)}>
          <div className="bg-white dark:bg-card rounded-[2rem] shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            {/* Compact Header */}
            <div className="flex items-center justify-between px-6 py-5 bg-primary text-white">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-black text-sm ring-2 ring-white/10">{selectedReport.userName?.charAt(0)}</div>
                <div>
                  <p className="font-black text-base leading-none">{selectedReport.userName}</p>
                  <p className="text-[11px] font-bold opacity-80 mt-1 uppercase tracking-wider">{safeFormatDate(selectedReport.date || selectedReport.Date)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedReport(null)} className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center backdrop-blur-md hover:bg-white/25 transition-colors"><X className="h-5 w-5" /></button>
            </div>

            {/* Compact Body */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3 no-scrollbar bg-slate-50/50">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Log Entries ({selectedReport.entries?.length || 0})</span>
              </div>
              
              {(selectedReport.entries || []).map((e: any, i: number) => (
                <div 
                  key={i} 
                  className={cn(
                    "p-4 rounded-2xl border bg-white shadow-sm transition-all active:scale-[0.98]", 
                    e.status === 'pending' ? "border-amber-100" : "border-emerald-100"
                  )} 
                  onClick={() => { setSelectedReport(null); navigate(`/admin/work-allocation?userId=${selectedReport.userId}`); }}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className="font-black text-xs text-slate-800 leading-tight flex-1">{e.workTitle}</h4>
                    <Badge className={cn(
                      "text-[7px] h-4 px-1.5 border-0 rounded-md font-black uppercase tracking-tighter", 
                      e.status === 'pending' ? "bg-amber-400 text-white" : "bg-emerald-500 text-white"
                    )}>
                      {e.status === 'pending' ? 'Pending' : 'Done'}
                    </Badge>
                  </div>
                  
                  {e.description && (
                    <p className="text-[10px] font-bold text-slate-500 italic mb-3 line-clamp-2 leading-snug">"{e.description}"</p>
                  )}
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-3">
                      {e.quantity !== undefined && e.quantity !== null && e.quantity > 0 && (
                        <div className="flex items-center gap-1 text-[9px] font-black text-slate-500">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">×{e.quantity}</span>
                        </div>
                      )}
                      {e.timeSpent && e.timeSpent !== '0h 0m' && (
                        <div className="flex items-center gap-1 text-[9px] font-black text-slate-500">
                          <Clock className="h-3 w-3" />
                          {e.timeSpent}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-black text-primary">
                      Allocations <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              ))}

              {selectedReport.complaints?.length > 0 && (
                <div className="pt-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Issues</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedReport.complaints.map((c: any) => (
                      <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-100">
                        <span className="text-[10px] font-black text-rose-600">{c.complaintNumber}</span>
                        <div className="h-1 w-1 rounded-full bg-rose-300" />
                        <span className="text-[8px] font-black text-rose-400 uppercase">Alert</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Compact Footer */}
            <div className="p-4 bg-white border-t">
              <Button className="w-full h-11 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/10" onClick={() => setSelectedReport(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Analytics;