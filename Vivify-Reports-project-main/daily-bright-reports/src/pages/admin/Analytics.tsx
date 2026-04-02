import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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
  const { canExport } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [customStartDate, setCustomStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [users, setUsers] = useState<any[]>([]);
  const [availableWorks, setAvailableWorks] = useState<any[]>([]);
  const [workSearchQuery, setWorkSearchQuery] = useState('');
  const [selectedWorks, setSelectedWorks] = useState<string[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, worksRes, clientsRes] = await Promise.all([
          api.users.getAll(),
          api.works.getAll(),
          api.clients.getAll()
        ]);

        if (usersRes.success && usersRes.data) {
          setUsers(usersRes.data.map((u: any) => ({ ...u, name: u.fullName })));
        }
        if (worksRes.success && worksRes.data) {
          setAvailableWorks(worksRes.data);
        }
        if (clientsRes.success && clientsRes.data) {
          const map: Record<string, string> = {};
          clientsRes.data.forEach((c: any) => {
            map[c.id.toString()] = c.name;
          });
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
        } else if (timeRange === 'custom') {
          params.startDate = customStartDate;
          params.endDate = customEndDate;
        }

        const [analyticsRes, reportsRes] = await Promise.all([
          api.admin.getAnalytics(params),
          api.admin.getAllReports(params)
        ]);

        if (!controller.signal.aborted) {
          if (analyticsRes.success && analyticsRes.data) {
            setAnalyticsData(analyticsRes.data);
          }
          if (reportsRes.success) {
            setReports(reportsRes.data || []);
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Error fetching analytics:", error);
          if (showLoading) toast.error("Failed to load analytics");
        }
      } finally {
        if (!controller.signal.aborted && showLoading) {
          setIsLoading(false);
        }
      }
    };

    fetchAnalytics(true);

    // Auto-refresh every 30 seconds
    const intervalId = setInterval(() => {
      fetchAnalytics(false); // Don't show loading spinner for background updates
    }, 30000);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [selectedUser, timeRange, selectedWorks, customStartDate, customEndDate]);

  const filteredReports = selectedUser === 'all'
    ? (reports || [])
    : (reports || []).filter(report => {
      const userId = report.userId || report.UserId || report.userid;
      return userId?.toString() === selectedUser;
    });

  const trendData = (() => {
    if (!analyticsData) return [];

    const rawTrend = analyticsData.type === 'comparison'
      ? (analyticsData.trendData || [])
      : (analyticsData.data || []);

    return rawTrend
      .filter((item: any) => item && item.date)
      .map((item: any) => ({
        date: safeFormatDate(item.date, timeRange === 'year' ? 'MMM' : 'MMM dd'),
        entries: item.workCount || 0
      }));
  })();

  // Process data for the chart - Productivity Focus (Completed vs Pending)
  const employeeStats = users.map(user => {
    const userReports = filteredReports.filter(r => r.userId === user.id);
    const totalEntries = userReports.reduce((acc, r) => acc + (r.entries?.length || 0), 0);

    // Calculate status breakdown
    let completedCount = 0;
    let pendingCount = 0;

    userReports.forEach(report => {
      if (report.entries) {
        report.entries.forEach((entry: any) => {
          // Check entry status if available, otherwise assume completed if report is old? 
          // For now, let's look at the entry status property if it exists
          if (entry.status && entry.status === 'pending') {
            pendingCount++;
          } else {
            // If status is 'completed' or undefined (legacy), count as completed
            completedCount++;
          }
        });
      }
    });

    return {
      name: user.name.split(' ')[0],
      completed: completedCount,
      pending: pendingCount,
      total: totalEntries
    };
  }).filter(stat => stat.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);

  const workTypeDistribution = (() => {
    const counts: Record<string, number> = {};
    if (filteredReports && filteredReports.length > 0) {
      filteredReports.forEach((report) => {
        if (report && report.entries) {
          report.entries.forEach((entry: any) => {
            if (entry) {
              const type = entry.workTitle || entry.WorkTitle || 'Other';
              counts[type] = (counts[type] || 0) + 1;
            }
          });
        }
      });
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  })();

  const handleUpdateDueDate = async (reportId: number, entryIndex: number, newDate: string) => {
    if (!newDate) return;

    try {
      const response = await api.admin.updateEntryDueDate(reportId, entryIndex, newDate);
      if (response.success) {
        toast.success("Due date updated successfully.");
      } else {
        toast.error(response.message || "Failed to update due date");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    }
  };

  const handleUpdateEntryStatus = async (reportId: number, entryIndex: number, status: string) => {
    // Optimistic update
    setReports(prev => prev.map(r => {
      if (r.id !== reportId) return r;
      const entries = [...(r.entries || [])];
      entries[entryIndex] = { ...entries[entryIndex], status };
      return { ...r, entries };
    }));

    try {
      const response = await api.admin.updateEntryStatus(reportId, entryIndex, status);
      if (response.success) {
        toast.success(`Status updated to ${status === 'in_progress' ? 'In Progress' : 'Completed'}.`);
      } else {
        toast.error(response.message || "Failed to update status");
        // Revert on failure
        setReports(prev => prev.map(r => {
          if (r.id !== reportId) return r;
          const entries = [...(r.entries || [])];
          entries[entryIndex] = { ...entries[entryIndex], status: 'pending' };
          return { ...r, entries };
        }));
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    }
  };

  const handleExport = async (formatType: 'excel' | 'csv') => {
    if (filteredReports.length === 0) {
      toast.info("No data available to export.");
      return;
    }

    toast.info(`Preparing ${formatType.toUpperCase()} file...`);

    try {
      // Flatten reports into a row-based format for CSV
      const rows: any[] = [];
      filteredReports.forEach(report => {
        if (report.entries && report.entries.length > 0) {
          report.entries.forEach((entry: any) => {
            // Resolve Client Name (Company)
            let companyName = 'N/A';
            if (entry.newClientName) {
              companyName = entry.newClientName;
            } else if (entry.clientId) {
              companyName = clientsMap[entry.clientId.toString()] || 'Unknown Client';
            }

            rows.push({
              'Date': safeFormatDate(report.date || report.Date),
              'Username': report.userName || 'Unknown',
              'Work Code': entry.workCode || 'N/A',
              'Work': entry.workTitle || entry.WorkTitle || 'N/A',
              'Count': entry.quantity || 0,
              'Completed or Not': entry.status === 'pending' ? 'Pending' : 'Completed',
              'Due Date': entry.status === 'pending' ? (safeFormatDate(entry.adminDueDate || entry.dueDate)) : 'N/A',
              'Company': companyName,
              'Description': entry.description || 'N/A',
              'Time Spent': entry.hoursSpent || entry.timeSpent || '0'
            });
          });
        } else {
          rows.push({
            'Date': safeFormatDate(report.date || report.Date),
            'Username': report.userName || 'Unknown',
            'Work Code': 'N/A',
            'Work': 'No entries',
            'Count': 0,
            'Completed or Not': 'N/A',
            'Due Date': 'N/A',
            'Company': 'N/A',
            'Description': 'N/A',
            'Time Spent': '0'
          });
        }
      });

      const fileName = `reports-export-${new Date().toISOString().split('T')[0]}.${formatType === 'excel' ? 'xlsx' : 'csv'}`;

      let fileContent: any;
      let mimeType: string;

      if (formatType === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");

        if (Capacitor.isNativePlatform()) {
          fileContent = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        } else {
          const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
          fileContent = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        }
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else {
        const headers = Object.keys(rows[0]);
        const csvText = [
          headers.join(','),
          ...rows.map(row =>
            headers.map(header => {
              const val = row[header] === null || row[header] === undefined ? '' : row[header];
              const escaped = String(val).replace(/"/g, '""');
              return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')
                ? `"${escaped}"`
                : escaped;
            }).join(',')
          )
        ].join('\r\n');

        fileContent = csvText;
        mimeType = 'text/csv;charset=utf-8;';
      }

      if (Capacitor.isNativePlatform()) {
        try {
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: fileContent,
            encoding: formatType === 'csv' ? ('utf8' as any) : undefined,
            directory: Directory.Cache,
          });

          await Share.share({
            title: 'Export Reports',
            text: `Your report export is ready.`,
            url: savedFile.uri,
            dialogTitle: 'Share or Save Export',
          });
          toast.success('File ready to share/save');
        } catch (error) {
          console.error('File saving error:', error);
          toast.error('Failed to save file on device');
        }
      } else {
        const downloadUrl = formatType === 'excel'
          ? window.URL.createObjectURL(fileContent as Blob)
          : window.URL.createObjectURL(new Blob([fileContent], { type: mimeType }));

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
        toast.success('Download started');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  const handleWhatsAppExport = async () => {
    if (filteredReports.length === 0) {
      toast.info("No data available to export.");
      return;
    }

    toast.info("Preparing Excel file...");

    try {
      const rows: any[] = [];
      filteredReports.forEach(report => {
        if (report.entries && report.entries.length > 0) {
          report.entries.forEach((entry: any) => {
            let companyName = 'N/A';
            if (entry.newClientName) {
              companyName = entry.newClientName;
            } else if (entry.clientId) {
              companyName = clientsMap[entry.clientId.toString()] || 'Unknown Client';
            }
            rows.push({
              'Date': safeFormatDate(report.date || report.Date),
              'Username': report.userName || 'Unknown',
              'Work Code': entry.workCode || 'N/A',
              'Work': entry.workTitle || entry.WorkTitle || 'N/A',
              'Count': entry.quantity || 0,
              'Completed or Not': entry.status === 'pending' ? 'Pending' : 'Completed',
              'Due Date': entry.status === 'pending' ? (safeFormatDate(entry.adminDueDate || entry.dueDate)) : 'N/A',
              'Company': companyName,
              'Description': entry.description || 'N/A',
              'Time Spent': entry.hoursSpent || entry.timeSpent || '0'
            });
          });
        }
      });

      const fileName = `analytics-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");

      if (Capacitor.isNativePlatform()) {
        // Native app — save and share via native share sheet
        const fileContent = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: fileContent,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'Analytics Report',
          text: 'Here is the analytics report.',
          url: savedFile.uri,
          dialogTitle: 'Share via WhatsApp'
        });
        toast.success('Share sheet opened');
      } else {
        // Web — download the file first
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);

        // Show persistent toast with WhatsApp button
        const waText = encodeURIComponent(`Hi, please find the analytics report attached: ${fileName}`);
        toast.success('Excel file downloaded!', {
          description: 'Now open WhatsApp and attach the downloaded file.',
          duration: 10000,
          action: {
            label: '📲 Open WhatsApp',
            onClick: () => window.open(`https://wa.me/?text=${waText}`, '_blank'),
          },
        });
      }
    } catch (error) {
      console.error('WhatsApp export error:', error);
      toast.error('Failed to prepare file');
    }
  };

  const totalReports = filteredReports.length;
  const totalEntries = filteredReports.reduce((sum, r) => sum + r.entries.length, 0);
  const avgEntriesPerReport = totalReports > 0 ? (totalEntries / totalReports).toFixed(1) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
              <p className="text-muted-foreground">Monitor performance and report distribution</p>
            </div>
            <Button onClick={handleWhatsAppExport} className="lg:hidden btn-gradient rounded-xl gap-2 shadow-md" size="sm" disabled={!canExport}>
              <Download className="h-4 w-4" />
              Share Excel
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[200px] bg-card">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="bg-card gap-2">
                  <Filter className="h-4 w-4" />
                  Work Types ({selectedWorks.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm">Filter by Work Type</p>
                    {selectedWorks.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-primary font-bold"
                        onClick={() => setSelectedWorks([])}
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search categories..."
                      className="pl-8 h-9"
                      value={workSearchQuery}
                      onChange={(e) => setWorkSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                  {availableWorks
                    .filter(w => w.workTitle.toLowerCase().includes(workSearchQuery.toLowerCase()))
                    .map((work) => (
                      <div
                        key={work.id}
                        className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedWorks(prev =>
                            prev.includes(work.workTitle)
                              ? prev.filter(t => t !== work.workTitle)
                              : [...prev, work.workTitle]
                          );
                        }}
                      >
                        <Checkbox
                          id={`work-${work.id}`}
                          checked={selectedWorks.includes(work.workTitle)}
                          onCheckedChange={() => { }}
                        />
                        <label className="text-sm cursor-pointer flex-1 truncate">{work.workTitle}</label>
                      </div>
                    ))}
                </div>
              </PopoverContent>
            </Popover>

            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-[160px] bg-card">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">Full Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {timeRange === 'custom' && (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-[150px] bg-card"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-[150px] bg-card"
                />
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 btn-gradient border-none rounded-xl" disabled={!canExport} title={!canExport ? "You don't have export permission" : undefined}>
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer">
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-success" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4 text-primary" />
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-none shadow-md overflow-hidden group rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Coverage</p>
                  <p className="text-3xl font-black">{users.length} <span className="text-sm font-normal text-muted-foreground">Users</span></p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Reports Count</p>
                  <p className="text-3xl font-black">{totalReports}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center text-success group-hover:bg-success group-hover:text-success-foreground transition-colors">
                  <FileText className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Work Density</p>
                  <p className="text-3xl font-black">{totalEntries}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center text-warning group-hover:bg-warning group-hover:text-warning-foreground transition-colors">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Entries / Report</p>
                  <p className="text-3xl font-black">{avgEntriesPerReport}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                  <BarChart3 className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Team Productivity Breakdown</CardTitle>
              <CardDescription>Completed vs. Pending tasks per employee</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={employeeStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={12}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.4} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#4b5563', fontSize: 12 }}
                      dx={-10}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                    <Bar
                      dataKey="completed"
                      name="Completed Tasks"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                    />
                    <Bar
                      dataKey="pending"
                      name="Pending Actions"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Work Category Distribution</CardTitle>
              <CardDescription>Top 5 most frequent work categories in this period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workTypeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name.slice(0, 15)} ${(percent * 100).toFixed(0)}%`}
                    >
                      {workTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle>Submission Trend</CardTitle>
            <CardDescription>Volume of work entries filed over current timeframe</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-80 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="entries"
                    stroke="hsl(var(--primary))"
                    strokeWidth={4}
                    dot={{ fill: 'hsl(var(--primary))', r: 5, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 8, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl border-t-4 border-t-destructive overflow-hidden">
          <CardHeader className="bg-destructive/[0.03] border-b border-destructive/10 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Pending Work Monitor
                </CardTitle>
                <CardDescription>Manage and update deadlines for pending work entries</CardDescription>
              </div>
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-bold uppercase tracking-wider text-[10px] px-3">
                Action Required
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {(() => {
              const pendingReports = (reports || []).filter(report =>
                report && report.entries && report.entries.some((entry: any) =>
                  entry && entry.status === 'pending'
                )
              );

              if (pendingReports.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                    <CheckCircle2 className="h-16 w-16 text-success/20 mb-4" />
                    <h3 className="text-xl font-bold mb-1">Excellent Coverage!</h3>
                    <p className="text-muted-foreground text-sm max-w-sm">
                      There are currently no pending work items in the system for this period.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid gap-6 md:grid-cols-2">
                  {pendingReports.map(report => {
                    const pendingEntries = (report.entries || []).filter((e: any) =>
                      e && e.status === 'pending'
                    );

                    return (
                      <Card key={report.id} className="border-none shadow-md bg-muted/20 hover:shadow-lg transition-all">
                        <CardHeader className="pb-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                              <Users className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{report.userName}</CardTitle>
                              <CardDescription className="flex items-center gap-1.5 text-xs font-semibold">
                                <Calendar className="h-3 w-3" />
                                Filed on {safeFormatDate(report.date || report.Date)}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {pendingEntries.map((e: any, idx: number) => {
                            const originalIdx = (report.entries || []).findIndex((entry: any) => entry === e);
                            const isOverdue = e.dueDate && new Date(e.dueDate) < new Date();

                            return (
                              <div key={idx} className={cn(
                                "p-4 rounded-xl border-2 transition-all",
                                isOverdue ? "bg-destructive/[0.04] border-destructive/20" : "bg-card border-border"
                              )}>
                                <div className="flex items-start justify-between gap-4 mb-3">
                                  <p className="font-bold text-sm leading-tight">{e.workTitle}</p>
                                  <Badge variant={isOverdue ? "destructive" : "secondary"} className="h-5 text-[10px]">
                                    {isOverdue ? "Overdue" : "Pending"}
                                  </Badge>
                                </div>
                                <div className="space-y-3 pt-3 border-t">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                                      <Clock className="h-3.5 w-3.5" />
                                      Current Due: <span className="text-foreground ml-1">
                                        {e.adminDueDate ? format(new Date(e.adminDueDate), 'MMM dd, yyyy') : safeFormatDate(e.dueDate)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                      <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                      <input
                                        type="date"
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-9 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        onChange={(event) => handleUpdateDueDate(report.id, originalIdx, event.target.value)}
                                      />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Update</span>
                                  </div>
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      onClick={() => handleUpdateEntryStatus(report.id, originalIdx, 'in_progress')}
                                      className="flex-1 h-8 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                                    >
                                      In Progress
                                    </button>
                                    <button
                                      onClick={() => handleUpdateEntryStatus(report.id, originalIdx, 'completed')}
                                      className="flex-1 h-8 rounded-lg text-xs font-semibold bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors"
                                    >
                                      Completed
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle>Detailed Log Records</CardTitle>
            <CardDescription>Comprehensive report data based on your filters</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredReports.length === 0 ? (
              <div className="p-20">
                <EmptyState
                  icon={<FileText className="h-16 w-16 text-muted-foreground/20" />}
                  title="No Matching Records"
                  description="Adjust your filters to see more results"
                  className="bg-transparent"
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="border-x">
                  <TableHeader className="bg-primary hover:bg-primary">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-white font-semibold last:border-r-0 h-11 italic">Employee</TableHead>
                      <TableHead className="text-white font-semibold last:border-r-0 h-11">Report Date</TableHead>
                      <TableHead className="text-white font-semibold last:border-r-0 h-11 text-center">Entries</TableHead>
                      <TableHead className="text-white font-semibold last:border-r-0 h-11">Work Overview</TableHead>
                      <TableHead className="text-white font-semibold last:border-r-0 h-11">Complaints</TableHead>
                      <TableHead className="text-right text-white font-semibold px-4 h-11">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.slice(0, 50).map((report) => {
                      const hasPending = report.entries?.some((e: any) => e.status === 'pending');
                      return (
                        <TableRow key={report.id} className="transition-colors group hover:bg-slate-50/50">
                          <TableCell className="font-bold text-base border-r border-slate-200 last:border-r-0">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center border font-normal text-muted-foreground">
                                {report.userName?.charAt(0) || 'U'}
                              </div>
                              {report.userName || 'Unknown'}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-muted-foreground border-r border-slate-200 last:border-r-0">
                            {safeFormatDate(report.date || report.Date)}
                          </TableCell>
                          <TableCell className="text-center border-r border-slate-200 last:border-r-0">
                            <Badge variant="outline" className="bg-background group-hover:bg-primary/10 transition-colors font-mono font-bold px-3">
                              {report.entries?.length || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px] border-r border-slate-200 last:border-r-0">
                            <p className="text-sm text-muted-foreground truncate font-medium group-hover:text-foreground transition-colors">
                              {(report.entries || []).map((e: any) => e.workTitle).join(', ')}
                            </p>
                          </TableCell>
                          <TableCell className="border-r border-slate-200 last:border-r-0">
                            {report.complaints?.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {report.complaints.slice(0, 2).map((c: any) => (
                                  <Badge key={c.id} variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                                    {c.complaintNumber}
                                  </Badge>
                                ))}
                                {report.complaints.length > 2 && (
                                  <Badge variant="outline" className="text-[10px]">+{report.complaints.length - 2}</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right border-r border-slate-200 last:border-r-0">
                            {hasPending ? (
                              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 font-bold px-3">Pending Items</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-success/10 text-success border-success/20 font-bold px-3">Completed</Badge>
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
    </DashboardLayout>
  );
};

export default Analytics;
