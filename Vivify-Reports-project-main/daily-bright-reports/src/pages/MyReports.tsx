import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { FileText, Calendar as CalendarIcon, TrendingUp, Clock, Loader2, Download, Plus } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, subDays } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type TimeRange = 'weekly' | 'monthly' | 'yearly' | 'custom';

const MyReports: React.FC = () => {
  // ... (Existing state)
  const { user, canExport } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly');
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // ... (getDateRange, useEffect with fetchReports - no change)

  const getDateRange = (range: TimeRange) => {
    const now = new Date();
    switch (range) {
      case 'weekly':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'monthly':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'yearly':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom':
        return { start: dateRange?.from || now, end: dateRange?.to || now };
    }
  };

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        const { start, end } = getDateRange(timeRange);
        // Ensure end date includes the full day if it's not set (for custom range)
        const effectiveEnd = end ? new Date(end) : new Date(start);
        if (timeRange === 'custom') {
          effectiveEnd.setHours(23, 59, 59, 999);
        }

        const response = await api.reports.getMyReports({
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(effectiveEnd, 'yyyy-MM-dd')
        });

        if (response.success && response.data) {
          setReports(response.data);
        }
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [timeRange, dateRange]);


  const { start } = getDateRange(timeRange);
  const filteredReports = reports;
  const totalEntries = filteredReports.length; // each WorkAllocation record = 1 entry

  const getChartData = () => {
    if (timeRange === 'custom' && dateRange?.from && dateRange?.to) {
      const data = [];
      let current = new Date(dateRange.from);
      const end = dateRange.to;
      while (current <= end) {
        const dateStr = format(current, 'yyyy-MM-dd');
        const dayReports = reports.filter((r) => {
          const d = r.createdAt || r.date || r.Date;
          if (!d) return false;
          try { return format(parseISO(d), 'yyyy-MM-dd') === dateStr; } catch { return false; }
        });
        const entriesCount = dayReports.length;
        data.push({ label: format(current, 'MMM dd'), entries: entriesCount });
        current.setDate(current.getDate() + 1);
      }
      return data;
    }

    if (timeRange === 'weekly') {
      const data = [];
      const s = startOfWeek(new Date());
      for (let i = 0; i < 7; i++) {
        const date = new Date(s);
        date.setDate(date.getDate() + i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayReports = reports.filter((r) => {
          const d = r.createdAt || r.date || r.Date;
          if (!d) return false;
          try { return format(parseISO(d), 'yyyy-MM-dd') === dateStr; } catch { return false; }
        });
        const entriesCount = dayReports.length;
        data.push({ label: format(date, 'EEE'), entries: entriesCount });
      }
      return data;
    } else if (timeRange === 'monthly') {
      const data = [];
      const s = startOfMonth(new Date());
      const weeks = 5;
      for (let i = 0; i < weeks; i++) {
        const weekStart = new Date(s);
        weekStart.setDate(weekStart.getDate() + i * 7);
        if (weekStart > endOfMonth(new Date())) break;
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekReports = reports.filter((r) => {
          const d = r.createdAt || r.date || r.Date;
          if (!d) return false;
          try {
            const reportDate = parseISO(d);
            return reportDate >= weekStart && reportDate <= weekEnd;
          } catch { return false; }
        });
        const entries = weekReports.length;
        data.push({ label: `Week ${i + 1}`, entries });
      }
      return data;
    } else {
      // yearly
      const data = [];
      const s = startOfYear(new Date());
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(s.getFullYear(), i, 1);
        const monthEnd = new Date(s.getFullYear(), i + 1, 0);
        const monthReports = reports.filter((r) => {
          const d = r.createdAt || r.date || r.Date;
          if (!d) return false;
          try {
            const reportDate = parseISO(d);
            return reportDate >= monthStart && reportDate <= monthEnd;
          } catch { return false; }
        });
        const entries = monthReports.length;
        data.push({ label: format(monthStart, 'MMM'), entries });
      }
      return data;
    }
  };

  const chartData = getChartData();

  const handleExport = () => {
    if (filteredReports.length === 0) { toast.info("No reports to export"); return; }

    const rows: any[] = [];
    filteredReports.forEach((report: any) => {
      rows.push({
        'Date': (() => { const d = report.createdAt || report.date; if (!d) return 'N/A'; try { return format(parseISO(d), 'dd-MMM-yyyy'); } catch { return 'N/A'; } })(),
        'Work Title': report.title || report.Title || 'N/A',
        'Description': report.description || report.Description || 'N/A',
        'Priority': report.priority || 'N/A',
        'Status': report.status || 'N/A',
        'Due Date': report.dueDate ? (() => { try { return format(parseISO(report.dueDate), 'dd-MMM-yyyy'); } catch { return 'N/A'; } })() : 'N/A',
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'My Reports');
    const fileName = `my-reports-${user?.fullName?.replace(/\s+/g, '-') ?? 'export'}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Download started');
  };

  return (
    <DashboardLayout>
      {/* Mobile Date Picker Dialog (Moved to Top Level for Stability) */}
      <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <DialogContent className="w-[90%] max-w-[340px] p-0 rounded-3xl overflow-hidden shadow-2xl border-none z-[200]">
            <DialogHeader className="p-4 bg-primary text-white text-left">
                <DialogTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" /> Select Range
                </DialogTitle>
            </DialogHeader>
            <div className="p-2 flex justify-center bg-white">
                <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                    setDateRange(range);
                    if (range?.from && range?.to) {
                        setIsDatePickerOpen(false);
                    }
                }}
                numberOfMonths={1}
                className="rounded-2xl"
                />
            </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 -mx-3 -mt-4 md:m-0 pb-20 md:pb-0">
        {/* Mobile Premium Header */}
        <div className="lg:hidden relative pb-14">
          <div className="absolute inset-0 bg-primary/95 dark:bg-primary/90 h-[225px] rounded-b-[3.5rem] shadow-2xl shadow-primary/20" />
          <div className="relative pt-8 px-4 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1 px-1">
                <h1 className="text-2xl font-black text-white tracking-tight">My Reports</h1>
                <p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em]">Performance Tracking</p>
              </div>
              <div className="flex gap-2">
                <Button 
                    variant="secondary" 
                    className="flex-1 h-11 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-white backdrop-blur-md shadow-lg transition-all active:scale-[0.98] px-2 gap-2 text-[10px] font-black uppercase tracking-widest overflow-hidden"
                    onClick={handleExport}
                >
                    <Download className="h-4 w-4 shrink-0" />
                    <span className="truncate">Export Excel</span>
                </Button>
                <Button 
                    className="flex-[1.2] h-11 rounded-2xl bg-white text-primary hover:bg-white/90 shadow-xl shadow-black/20 transition-all active:scale-[0.98] px-2 gap-2 text-[10px] font-black uppercase tracking-widest overflow-hidden"
                    onClick={() => window.location.hash = '/daily-report'}
                >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="truncate">Create Report</span>
                </Button>
              </div>
            </div>

            {/* Premium Mobile Progress Row - Grid Layout (No Scrolling) */}
            <div className="grid grid-cols-2 gap-3 py-1">
              <div className="bg-white rounded-[1.5rem] p-3.5 shadow-lg shadow-black/10 border border-white/20">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-primary" /> Reports
                </p>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-800 tracking-tighter">{filteredReports.length}</span>
                    <span className="text-[10px] font-bold text-slate-400">Total</span>
                </div>
              </div>
              <div className="bg-white rounded-[1.5rem] p-3.5 shadow-lg shadow-black/10 border border-white/20">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3 text-emerald-500" /> Entries
                </p>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-800 tracking-tighter">{totalEntries}</span>
                    <span className="text-[10px] font-bold text-slate-400">Items</span>
                </div>
              </div>
              <div className="col-span-2 bg-white rounded-[2rem] p-4 shadow-lg shadow-black/10 border border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-2xl bg-amber-50 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-amber-500" />
                   </div>
                   <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Efficiency</p>
                        <p className="text-sm font-black text-slate-800">Entries Per Report</p>
                   </div>
                </div>
                <div className="text-right">
                    <span className="text-3xl font-black text-primary tracking-tighter">
                        {filteredReports.length > 0 ? (totalEntries / filteredReports.length).toFixed(1) : 0}
                    </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Header ... (unchanged) */}
        <div className="hidden lg:flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">My Reports</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">View your submitted work reports and performance tracking</p>
          </div>
          <div className="flex gap-3 items-center">
            <Button
              variant="outline"
              className="gap-2 h-11 rounded-xl border-dashed border-2 hover:bg-primary/5 transition-all"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 text-primary" />
              <span className="font-bold">Export Excel</span>
            </Button>
            <Button className="gap-2 h-11 rounded-xl shadow-lg shadow-primary/20 transition-all font-bold px-6" onClick={() => window.location.hash = '/daily-report'}>
              <Plus className="h-5 w-5" />
              Create New Report
            </Button>
          </div>
        </div>

        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)} className="space-y-6">
          <div className="sticky top-0 z-40 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-none px-4 pt-4 lg:p-0 -mx-4 lg:mx-0">
            <TabsList className={cn(
              "p-1.5 bg-white dark:bg-card/50 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 w-full flex"
            )}>
              <TabsTrigger value="weekly" className="flex-1 lg:flex-none gap-2 rounded-xl font-black text-[11px] uppercase tracking-wider py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Weekly</TabsTrigger>
              <TabsTrigger value="monthly" className="flex-1 lg:flex-none gap-2 rounded-xl font-black text-[11px] uppercase tracking-wider py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Monthly</TabsTrigger>
              <TabsTrigger value="yearly" className="flex-1 lg:flex-none gap-2 rounded-xl font-black text-[11px] uppercase tracking-wider py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Yearly</TabsTrigger>
              <TabsTrigger value="custom" className="flex-1 lg:flex-none gap-2 rounded-xl font-black text-[11px] uppercase tracking-wider py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Custom</TabsTrigger>
            </TabsList>

            {timeRange === 'custom' && (
              <div className="mt-4 px-1 lg:hidden animate-in fade-in slide-in-from-top-2">
                <Button
                    id="date-mobile"
                    variant={"outline"}
                    className={cn(
                    "w-full h-12 justify-between text-left font-bold rounded-2xl bg-white border-2 border-dashed border-slate-200 text-slate-500",
                    !dateRange && "text-muted-foreground"
                    )}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDatePickerOpen(true);
                    }}
                >
                    <div className="flex items-center gap-3">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        <span className="text-[13px]">
                            {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                                </>
                            ) : (
                                format(dateRange.from, "LLL dd")
                            )
                            ) : (
                            "Select Date Range"
                            )}
                        </span>
                    </div>
                    <Plus className="h-4 w-4 opacity-50" />
                </Button>
              </div>
            )}
          </div>

          <div className="px-4 lg:p-0 space-y-6">
            <div className="hidden lg:grid gap-6 sm:grid-cols-3">
              <Card className="rounded-3xl border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden group">
                <CardContent className="p-6 flex items-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 group-hover:scale-110 transition-transform">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-black tracking-tight">{filteredReports.length}</p>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-0.5">Reports Submitted</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden group">
                <CardContent className="p-6 flex items-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100/50 group-hover:scale-110 transition-transform text-emerald-600">
                    <TrendingUp className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-3xl font-black tracking-tight">{totalEntries}</p>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-0.5">Total Work Entries</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden group">
                <CardContent className="p-6 flex items-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100/50 group-hover:scale-110 transition-transform text-amber-600">
                    <Clock className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-3xl font-black tracking-tight">
                      {filteredReports.length > 0 ? (totalEntries / filteredReports.length).toFixed(1) : 0}
                    </p>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-0.5">Avg. Entries/Report</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Chart */}
            <Card className="rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.04)] overflow-hidden bg-white/70 backdrop-blur-sm">
              <CardHeader className="pb-2 border-b border-slate-50">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Performance Metrics</CardTitle>
                    {timeRange === 'custom' && (
                        <div className="hidden lg:block">
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 rounded-lg font-bold text-xs gap-2">
                                    <CalendarIcon className="h-3 w-3" />
                                    Range Settings
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={(range) => {
                                    setDateRange(range);
                                    if (range?.from && range?.to) setIsDatePickerOpen(false);
                                    }}
                                    numberOfMonths={2}
                                />
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-64 relative">
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-3xl">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height="100%">
                    {timeRange === 'yearly' ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" vertical={false} />
                        <XAxis dataKey="label" className="text-[10px] font-bold text-slate-400" axisLine={false} tickLine={false} />
                        <YAxis className="text-[10px] font-bold text-slate-400" axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: 'none',
                            borderRadius: '16px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                            padding: '12px',
                          }}
                          itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                          labelStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '4px' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="entries"
                          stroke="hsl(var(--primary))"
                          strokeWidth={4}
                          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4, stroke: '#fff' }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" vertical={false} />
                        <XAxis dataKey="label" className="text-[10px] font-bold text-slate-400" axisLine={false} tickLine={false} />
                        <YAxis className="text-[10px] font-bold text-slate-400" axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                           contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: 'none',
                            borderRadius: '16px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                            padding: '12px',
                          }}
                          itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                          labelStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '4px' }}
                        />
                        <Bar dataKey="entries" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={24} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Reports List/Table */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">History Log</h3>
                    {!isLoading && filteredReports.length > 0 && <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg uppercase tracking-wider">{filteredReports.length} Reports</span>}
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white/50 backdrop-blur-sm rounded-[2.5rem] space-y-4 border border-dashed border-slate-200">
                    <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processing records...</p>
                  </div>
                ) : filteredReports.length === 0 ? (
                    <Card className="rounded-[2.5rem] border-dashed border-2 border-slate-200 bg-transparent shadow-none">
                        <CardContent className="flex flex-col items-center justify-center text-center p-12 space-y-4">
                            <div className="h-16 w-16 rounded-3xl bg-slate-100 flex items-center justify-center">
                                <FileText className="h-8 w-8 text-slate-300" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-600">No records found</h4>
                                <p className="text-xs text-slate-400 font-medium mt-1">You haven't submitted any reports for the selected {timeRange} period.</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                  <>
                    {/* Mobile Card List */}
                    <div className="lg:hidden space-y-3">
                        {filteredReports.map((report) => {
                             const hasPending = report.entries?.some((e: any) => e.status === 'pending');
                             const reportDate = report.createdAt || report.date || report.Date;
                             return (
                                <div key={report.id} className="bg-white rounded-[2rem] p-4 shadow-sm ring-1 ring-black/5 active:scale-[0.98] transition-all group">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Record Date</span>
                                            <span className="text-sm font-black text-slate-800 mt-1">
                                                {reportDate ? (() => { try { return format(parseISO(reportDate), 'dd MMM, yyyy'); } catch { return 'Unknown Date'; } })() : 'Untitled'}
                                            </span>
                                        </div>
                                        {hasPending ? (
                                            <Badge className="bg-amber-50 text-amber-600 border-none rounded-xl px-3 py-1 font-black text-[9px] uppercase tracking-wider">Incomplete</Badge>
                                        ) : (
                                            <Badge className="bg-emerald-50 text-emerald-600 border-none rounded-xl px-3 py-1 font-black text-[9px] uppercase tracking-wider">Finalized</Badge>
                                        )}
                                    </div>
                                    
                                    <div className="p-3.5 bg-slate-50 rounded-2xl mb-3 border border-slate-100">
                                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic line-clamp-2">"{report.title || report.Title || 'Standard Daily Performance Report'}"</p>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-5 w-5 rounded-lg bg-primary/5 flex items-center justify-center"><FileText className="h-3 w-3 text-primary" /></div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">1 Task</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-5 w-5 rounded-lg bg-primary/5 flex items-center justify-center"><Clock className="h-3 w-3 text-primary" /></div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{report.duration || report.totalTimeSpent || report.TotalTimeSpent || '0h'}</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-xl bg-slate-50 hover:bg-primary/10 hover:text-primary transition-colors">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                             )
                        })}
                    </div>

                    {/* Desktop Table */}
                    <Card className="hidden lg:block rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.04)] overflow-hidden">
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-slate-100">
                              <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6 px-10">Submission Date</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6 text-center">Volume</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6">Key Activity</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6 text-center">Work Time</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 py-6 text-center pr-10">Record Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredReports.map((report) => {
                              const hasPending = report.entries?.some((e: any) => e.status === 'pending');
                              const reportDate = report.createdAt || report.date || report.Date;
                              return (
                                <TableRow key={report.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                                  <TableCell className="font-bold py-6 px-10">
                                    {reportDate ? (() => { try { return format(parseISO(reportDate), 'dd MMM, yyyy'); } catch { return 'N/A'; } })() : 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-center font-black py-6">
                                    <span className="h-8 w-8 rounded-full bg-slate-100 inline-flex items-center justify-center text-xs">1</span>
                                  </TableCell>
                                  <TableCell className="max-w-md py-6">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm truncate">{report.title || report.Title || '—'}</span>
                                        <span className="text-[10px] font-medium text-slate-400 mt-0.5 line-clamp-1">{report.description || report.Description || 'No detailed description provided'}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center font-bold text-primary py-6">
                                    {report.duration || report.totalTimeSpent || report.TotalTimeSpent || '0h'}
                                  </TableCell>
                                  <TableCell className="text-center py-6 pr-10">
                                    <div className="flex items-center justify-center">
                                        {hasPending ? (
                                        <Badge variant="outline" className="bg-amber-100/50 text-amber-600 border-none text-[10px] h-6 px-4 font-black uppercase rounded-lg">Incomplete</Badge>
                                        ) : (
                                        <Badge variant="outline" className="bg-emerald-100/50 text-emerald-600 border-none text-[10px] h-6 px-4 font-black uppercase rounded-lg">Complete</Badge>
                                        )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </>
                )}
            </div>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default MyReports;