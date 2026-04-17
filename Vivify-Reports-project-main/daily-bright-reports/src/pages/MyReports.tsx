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
import { FileText, Calendar as CalendarIcon, TrendingUp, Clock, Loader2, Download } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, subDays } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Reports</h1>
            <p className="text-muted-foreground">View your submitted work reports and performance</p>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExport}
              title="Download my reports as Excel"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
            <Button className="gap-2" onClick={() => window.location.hash = '/daily-report'}>
              <FileText className="h-4 w-4" />
              Create Report
            </Button>

            {timeRange === 'custom' && (
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full sm:w-[300px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 max-w-[calc(100vw-2rem)]" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range);
                      // Close when both dates are selected
                      if (range?.from && range?.to) {
                        setIsDatePickerOpen(false);
                      }
                    }}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Tabs and rest of content ... */}
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
            {/* ... triggers ... */}
            <TabsTrigger value="weekly" className="gap-2"><CalendarIcon className="h-4 w-4" />Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="gap-2"><CalendarIcon className="h-4 w-4" />Monthly</TabsTrigger>
            <TabsTrigger value="yearly" className="gap-2"><CalendarIcon className="h-4 w-4" />Yearly</TabsTrigger>
            <TabsTrigger value="custom" className="gap-2"><CalendarIcon className="h-4 w-4" />Custom</TabsTrigger>
          </TabsList>

          <div className="mt-6 space-y-6">
            {/* ... stats ... */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{filteredReports.length}</p>
                    <p className="text-sm text-muted-foreground">Reports Submitted</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalEntries}</p>
                    <p className="text-sm text-muted-foreground">Total Work Entries</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {filteredReports.length > 0 ? (totalEntries / filteredReports.length).toFixed(1) : 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Avg. Entries/Report</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Chart</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 relative">
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height="100%">
                    {timeRange === 'yearly' ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="entries"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))' }}
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="entries" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Reports Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Report History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredReports.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="h-8 w-8 text-muted-foreground" />}
                    title="No reports found"
                    description={`You haven't submitted any reports for this ${timeRange} period.`}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="border-collapse">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="border-r last:border-r-0 text-center font-bold text-primary">Date</TableHead>
                          <TableHead className="border-r last:border-r-0 text-center font-bold text-primary">Work Entries</TableHead>
                          <TableHead className="border-r last:border-r-0 text-center font-bold text-primary">Tasks</TableHead>
                          <TableHead className="border-r last:border-r-0 text-center font-bold text-primary">Hours Spent</TableHead>
                          <TableHead className="text-center font-bold text-primary">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReports.map((report) => {
                          const hasPending = report.entries?.some((e: any) => e.status === 'pending');
                          return (
                            <TableRow key={report.id} className="hover:bg-muted/50">
                              <TableCell className="font-medium border-r last:border-r-0 align-middle">
                {(() => { const d = report.createdAt || report.date || report.Date; if (!d) return 'N/A'; try { return format(parseISO(d), 'dd-MMM-yyyy'); } catch { return 'N/A'; } })()}
                              </TableCell>
                              <TableCell className="border-r last:border-r-0 text-center align-middle">1</TableCell>
                              <TableCell className="max-w-xs truncate text-xs text-muted-foreground border-r last:border-r-0 align-middle">
                                {report.title || report.Title || '—'}
                              </TableCell>
                              <TableCell className="text-muted-foreground border-r last:border-r-0 text-center align-middle">
                                {report.duration || report.totalTimeSpent || report.TotalTimeSpent || '0h'}
                              </TableCell>
                              <TableCell className="text-center align-middle">
                                {hasPending ? (
                                  <Badge variant="outline" className="bg-amber-100/50 text-amber-600 border-amber-200 text-[10px] h-5">Pending</Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-emerald-100/50 text-emerald-600 border-emerald-200 text-[10px] h-5">Complete</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </Tabs>

      </div>
    </DashboardLayout>
  );
};

export default MyReports;
