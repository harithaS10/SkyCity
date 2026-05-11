import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { Users, CalendarIcon, X, Download, Loader2, ClipboardList, CheckCircle2, ArrowRight, History as HistoryIcon, Filter } from 'lucide-react';

const AdminReportsPage: React.FC = () => {
    const [standingPending, setStandingPending] = useState<any[]>([]);
    const [pendingToCompleted, setPendingToCompleted] = useState<any[]>([]);
    const [reassignmentHistory, setReassignmentHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('all');
    const [selectedItem, setSelectedItem] = useState<any>(null);

    // Filters
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');
    const [filterUser, setFilterUser] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    // Unique user names across all data for the user filter dropdown
    const allUsers = useMemo(() => {
        const names = new Set<string>();
        [...standingPending, ...pendingToCompleted, ...reassignmentHistory].forEach(item => {
            if (item.assignedToName) names.add(item.assignedToName);
        });
        return Array.from(names).sort();
    }, [standingPending, pendingToCompleted, reassignmentHistory]);

    const applyFilters = (items: any[], dateField: string) => {
        return items.filter(item => {
            const dateVal = item[dateField];
            if (filterFromDate && dateVal) {
                try {
                    if (new Date(dateVal) < startOfDay(new Date(filterFromDate))) return false;
                } catch { /* ignore */ }
            }
            if (filterToDate && dateVal) {
                try {
                    if (new Date(dateVal) > endOfDay(new Date(filterToDate))) return false;
                } catch { /* ignore */ }
            }
            if (filterUser !== 'all' && item.assignedToName !== filterUser) return false;
            if (filterPriority !== 'all' && (item.priority?.toLowerCase() || '') !== filterPriority) return false;
            if (filterStatus !== 'all' && (item.status?.toLowerCase() || '') !== filterStatus) return false;
            return true;
        });
    };

    const filteredAll = useMemo(() => {
        const allItems = [...standingPending, ...pendingToCompleted];
        return allItems.filter(item => {
            const dateVal = item.status === 'completed' ? item.completedAt : item.dueDate;
            if (filterFromDate && dateVal) {
                try {
                    if (new Date(dateVal) < startOfDay(new Date(filterFromDate))) return false;
                } catch { /* ignore */ }
            }
            if (filterToDate && dateVal) {
                try {
                    if (new Date(dateVal) > endOfDay(new Date(filterToDate))) return false;
                } catch { /* ignore */ }
            }
            if (filterUser !== 'all' && item.assignedToName !== filterUser) return false;
            if (filterPriority !== 'all' && (item.priority?.toLowerCase() || '') !== filterPriority) return false;
            if (filterStatus !== 'all' && (item.status?.toLowerCase() || '') !== filterStatus) return false;
            return true;
        });
    }, [standingPending, pendingToCompleted, filterFromDate, filterToDate, filterUser, filterPriority, filterStatus]);

    const filteredPending = useMemo(() => applyFilters(standingPending, 'dueDate'), [standingPending, filterFromDate, filterToDate, filterUser, filterPriority, filterStatus]);
    const filteredCompleted = useMemo(() => applyFilters(pendingToCompleted, 'completedAt'), [pendingToCompleted, filterFromDate, filterToDate, filterUser, filterPriority, filterStatus]);
    const filteredReassignment = useMemo(() => applyFilters(reassignmentHistory, 'originalAssignDate'), [reassignmentHistory, filterFromDate, filterToDate, filterUser, filterPriority, filterStatus]);

    const clearFilters = () => { setFilterFromDate(''); setFilterToDate(''); setFilterUser('all'); setFilterPriority('all'); setFilterStatus('all'); };
    const hasFilters = filterFromDate || filterToDate || filterUser !== 'all' || filterPriority !== 'all' || filterStatus !== 'all';

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            const [pendingRes, completedRes, reassignmentRes] = await Promise.all([
                api.admin.getStandingPending(),
                api.admin.getPendingToCompleted(),
                api.admin.getReassignmentHistory()
            ]);

            if (pendingRes.success) setStandingPending(pendingRes.data || []);
            if (completedRes.success) setPendingToCompleted(completedRes.data || []);
            if (reassignmentRes.success) setReassignmentHistory(reassignmentRes.data || []);
        } catch (error) {
            console.error('Error fetching reports:', error);
            toast.error('Failed to load reports');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async (formatType: 'csv' | 'excel') => {
        let data_to_export: any[] = [];
        let filename = '';

        if (activeTab === 'all') {
            data_to_export = [...standingPending, ...pendingToCompleted].map(item => ({
                Title: item.title,
                Description: item.description || '-',
                AssignedTo: item.assignedToName || 'Unknown',
                Priority: item.priority || '-',
                Status: item.status,
                Date: (item.status === 'completed' ? item.completedAt : item.dueDate) ? format(new Date(item.status === 'completed' ? item.completedAt : item.dueDate), 'yyyy-MM-dd') : 'No Due Date'
            }));
            filename = `all-work-${format(new Date(), 'yyyy-MM-dd')}`;
        } else if (activeTab === 'pending') {
            data_to_export = standingPending.map(item => ({
                Title: item.title,
                Description: item.description || '-',
                AssignedTo: item.assignedToName || 'Unknown',
                Priority: item.priority,
                DueDate: item.dueDate ? format(new Date(item.dueDate), 'yyyy-MM-dd') : 'No Due Date'
            }));
            filename = `standing-pending-${format(new Date(), 'yyyy-MM-dd')}`;
        } else if (activeTab === 'completed') {
            data_to_export = pendingToCompleted.map(item => ({
                Title: item.title,
                Description: item.description || '-',
                CompletedBy: item.assignedToName || 'Unknown',
                CompletedDate: item.completedAt ? format(new Date(item.completedAt), 'yyyy-MM-dd') : '-',
                Duration: item.duration || '-'
            }));
            filename = `pending-to-completed-${format(new Date(), 'yyyy-MM-dd')}`;
        } else if (activeTab === 'reassignment') {
            data_to_export = reassignmentHistory.map(item => ({
                WorkTitle: item.title,
                FromUser: item.previousAssigneeName || 'Unknown',
                ToUser: item.assignedToName || 'Unknown',
                Reason: item.reason || 'No reason provided',
                AssignedDate: item.originalAssignDate ? format(new Date(item.originalAssignDate), 'yyyy-MM-dd') : '-',
                ReassignedDate: item.reassignedDate ? format(new Date(item.reassignedDate), 'yyyy-MM-dd HH:mm') : '-',
                CompletedDate: item.completedDate ? format(new Date(item.completedDate), 'yyyy-MM-dd HH:mm') : 'Not Completed'
            }));
            filename = `reassignment-history-${format(new Date(), 'yyyy-MM-dd')}`;
        }

        if (data_to_export.length === 0) {
            toast.info("No data to export.");
            return;
        }

        const fullFilename = `${filename}.${formatType === 'excel' ? 'xlsx' : 'csv'}`;

        let fileContent: any;
        let mimeType: string;

        if (formatType === 'excel') {
            const worksheet = XLSX.utils.json_to_sheet(data_to_export);
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
            const headers = Object.keys(data_to_export[0]);
            const csvText = [
                headers.join(','),
                ...data_to_export.map(row =>
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

        // Check if running on mobile (Capacitor native platform)
        if (Capacitor.isNativePlatform()) {
            try {
                // Write file to Filesystem
                const savedFile = await Filesystem.writeFile({
                    path: fullFilename,
                    data: fileContent,
                    encoding: formatType === 'csv' ? ('utf8' as any) : undefined,
                    directory: Directory.Cache,
                });

                // Share the file
                await Share.share({
                    title: `Export: ${filename}`,
                    text: `Admin Report Export`,
                    url: savedFile.uri,
                    dialogTitle: 'Share Report',
                });

                toast.success('Report exported successfully!');
            } catch (error: any) {
                console.error('Error sharing file:', error);
                toast.error('Failed to export report');
            }
        } else {
            // Web platform: use traditional download
            const downloadUrl = formatType === 'excel'
                ? window.URL.createObjectURL(fileContent as Blob)
                : window.URL.createObjectURL(new Blob([fileContent], { type: mimeType }));

            const link = document.createElement("a");
            if (link.download !== undefined) {
                link.setAttribute("href", downloadUrl);
                link.setAttribute("download", fullFilename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadUrl);
                toast.success('Download started');
            }
        }
    };

    return (
        <DashboardLayout>
            <div className="animate-in fade-in duration-500">

                {/* ── DESKTOP HEADER (hidden on mobile) ── */}
                <div className="hidden sm:flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6 pt-2">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-primary">Administrative Reports</h1>
                        <p className="text-muted-foreground font-medium">Detailed insights into work allocation, completion trends, and reassignment history.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-nowrap">
                        <Select value={filterUser} onValueChange={setFilterUser}>
                            <SelectTrigger className="h-10 rounded-xl border border-input bg-background gap-2 px-3 min-w-[160px] text-sm font-medium shadow-sm">
                                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                                <SelectValue placeholder="All Employees" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 overflow-y-auto">
                                <SelectItem value="all">All Employees</SelectItem>
                                {allUsers.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="h-10 rounded-xl border border-input bg-background gap-2 px-3 w-[160px] text-sm font-medium shadow-sm">
                                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-10 text-sm rounded-xl gap-2 px-3 w-[145px] font-medium shadow-sm">
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    {filterFromDate ? format(new Date(filterFromDate), 'MMM dd') : 'From Date'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-card rounded-xl" align="start">
                                <Calendar
                                    mode="single"
                                    selected={filterFromDate ? new Date(filterFromDate) : undefined}
                                    onSelect={(date) => setFilterFromDate(date ? format(date, 'yyyy-MM-dd') : '')}
                                    disabled={(date) => date > new Date()}
                                    className="rounded-md"
                                />
                            </PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-10 text-sm rounded-xl gap-2 px-3 w-[145px] font-medium shadow-sm">
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    {filterToDate ? format(new Date(filterToDate), 'MMM dd') : 'To Date'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-card rounded-xl" align="start">
                                <Calendar
                                    mode="single"
                                    selected={filterToDate ? new Date(filterToDate) : undefined}
                                    onSelect={(date) => setFilterToDate(date ? format(date, 'yyyy-MM-dd') : '')}
                                    disabled={(date) => date > new Date()}
                                    className="rounded-md"
                                />
                            </PopoverContent>
                        </Popover>
                        {hasFilters && (
                            <Button variant="destructive" size="sm" onClick={clearFilters} className="h-10 gap-1.5 rounded-xl px-3 text-sm font-medium shadow-sm shrink-0">
                                <X className="h-4 w-4" /> Clear
                            </Button>
                        )}
                        <Button className="h-10 gap-2 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm shadow-sm shrink-0"
                            onClick={() => handleDownload('excel')}>
                            <Download className="h-4 w-4" /> Export Data
                        </Button>
                    </div>
                </div>
                {hasFilters && (
                    <p className="hidden sm:block text-xs text-muted-foreground font-medium mb-4">
                        {activeTab === 'all' && `${filteredAll.length} record${filteredAll.length !== 1 ? 's' : ''} found`}
                        {activeTab === 'pending' && `${filteredPending.length} record${filteredPending.length !== 1 ? 's' : ''} found`}
                        {activeTab === 'completed' && `${filteredCompleted.length} record${filteredCompleted.length !== 1 ? 's' : ''} found`}
                        {activeTab === 'reassignment' && `${filteredReassignment.length} record${filteredReassignment.length !== 1 ? 's' : ''} found`}
                    </p>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                    {/* ── DESKTOP TABLE VIEW ── */}
                    <div className="hidden sm:block">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
                            <TabsList className="inline-flex w-auto min-w-full lg:min-w-[600px] h-11 bg-muted/50 p-1">
                                <TabsTrigger value="all" className="flex-1 whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-medium transition-all">All</TabsTrigger>
                                <TabsTrigger value="pending" className="flex-1 whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-medium transition-all">Standing Pending</TabsTrigger>
                                <TabsTrigger value="completed" className="flex-1 whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-medium transition-all">Pending to Completed</TabsTrigger>
                                <TabsTrigger value="reassignment" className="flex-1 whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-medium transition-all">Reassignment History</TabsTrigger>
                            </TabsList>
                        </div>
                        <TabsContent value="all" className="mt-6">
                            <Card className="border-none shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-indigo-500" />All Work</CardTitle>
                                    <CardDescription>Overview of all assigned and completed work. Click a row to view details.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                <div className="rounded-md border overflow-hidden [&>div]:max-h-[500px]">
                                    <Table className="border-x">
                                        <TableHeader>
                                            <TableRow className="bg-primary hover:bg-primary h-9">
                                                <TableHead className="sticky top-0 border-r w-12 text-white font-bold py-2 text-xs bg-primary z-10">S.No</TableHead>
                                                <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Title</TableHead>
                                                <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Assigned To</TableHead>
                                                <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Status</TableHead>
                                                <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Priority</TableHead>
                                                <TableHead className="sticky top-0 text-white font-bold py-2 text-xs bg-primary z-10">Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredAll.length === 0 ? (
                                                <TableRow><TableCell colSpan={6} className="h-24 text-center">No work found.</TableCell></TableRow>
                                            ) : filteredAll.map((item, index) => (
                                                <TableRow key={item.id} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => setSelectedItem(item)}>
                                                    <TableCell className="border-r text-muted-foreground text-xs font-medium">{index + 1}</TableCell>
                                                    <TableCell className="font-medium border-r">{item.title}</TableCell>
                                                    <TableCell className="border-r">{item.assignedToName || 'Unknown'}</TableCell>
                                                    <TableCell className="border-r">
                                                        <Badge className={
                                                            item.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                            item.status === 'in-progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                            'bg-amber-100 text-amber-700 border-amber-200'
                                                        } variant="outline">
                                                            {item.status === 'in-progress' ? 'In Progress' : item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Pending'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="border-r"><Badge variant="outline" className="capitalize">{item.priority || '-'}</Badge></TableCell>
                                                    <TableCell>
                                                        {item.status === 'completed' 
                                                            ? (item.completedAt ? format(new Date(item.completedAt), 'MMM dd, yyyy') : '-') 
                                                            : (item.dueDate ? format(new Date(item.dueDate), 'MMM dd, yyyy') : 'No Due Date')}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="pending" className="mt-6">
                            <Card className="border-none shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-amber-500" />Standing Pending Work</CardTitle>
                                    <CardDescription>Work currently assigned but not yet completed. Click a row to view details.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                <div className="rounded-md border overflow-hidden [&>div]:max-h-[500px]">
                                    <Table className="border-x">
                                            <TableHeader>
                                                <TableRow className="bg-primary hover:bg-primary h-9">
                                                    <TableHead className="sticky top-0 border-r w-12 text-white font-bold py-2 text-xs bg-primary z-10">S.No</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Title</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Assigned To</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Status</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Priority</TableHead>
                                                    <TableHead className="sticky top-0 text-white font-bold py-2 text-xs bg-primary z-10">Due Date</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredPending.length === 0 ? (
                                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No pending work found.</TableCell></TableRow>
                                                ) : filteredPending.map((item, index) => (
                                                    <TableRow key={item.id} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => setSelectedItem(item)}>
                                                        <TableCell className="border-r text-muted-foreground text-xs font-medium">{index + 1}</TableCell>
                                                        <TableCell className="font-medium border-r">{item.title}</TableCell>
                                                        <TableCell className="border-r">{item.assignedToName || 'Unknown'}</TableCell>
                                                        <TableCell className="border-r">
                                                            <Badge className={
                                                                item.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                item.status === 'in-progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                                'bg-amber-100 text-amber-700 border-amber-200'
                                                            } variant="outline">
                                                                {item.status === 'in-progress' ? 'In Progress' : item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Pending'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="border-r"><Badge variant="outline" className="capitalize">{item.priority}</Badge></TableCell>
                                                        <TableCell>{item.dueDate ? format(new Date(item.dueDate), 'MMM dd, yyyy') : 'No Due Date'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="completed" className="mt-6">
                            <Card className="border-none shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Pending to Completed Work</CardTitle>
                                    <CardDescription>Work items that have been successfully completed.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                <div className="rounded-md border overflow-hidden [&>div]:max-h-[500px]">
                                    <Table className="border-x">
                                            <TableHeader>
                                                <TableRow className="bg-primary hover:bg-primary h-9">
                                                    <TableHead className="sticky top-0 border-r w-12 text-white font-bold py-2 text-xs bg-primary z-10">S.No</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Title</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Completed By</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Completion Date</TableHead>
                                                    <TableHead className="sticky top-0 text-white font-bold py-2 text-xs bg-primary z-10">Duration</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredCompleted.length === 0 ? (
                                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No completed work records found.</TableCell></TableRow>
                                                ) : filteredCompleted.map((item, index) => (
                                                    <TableRow key={item.id} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => setSelectedItem(item)}>
                                                        <TableCell className="border-r text-muted-foreground text-xs font-medium">{index + 1}</TableCell>
                                                        <TableCell className="font-medium border-r">{item.title}</TableCell>
                                                        <TableCell className="border-r">{item.assignedToName || 'Unknown'}</TableCell>
                                                        <TableCell className="border-r">{item.completedAt ? format(new Date(item.completedAt), 'MMM dd, yyyy') : '-'}</TableCell>
                                                        <TableCell className="text-muted-foreground text-xs italic">{item.duration || '-'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="reassignment" className="mt-6">
                            <Card className="border-none shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><HistoryIcon className="h-5 w-5 text-blue-500" />Reassignment History</CardTitle>
                                    <CardDescription>Audit trail of work items reassigned between users.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                <div className="rounded-md border overflow-hidden [&>div]:max-h-[500px]">
                                    <Table className="border-x">
                                            <TableHeader>
                                                <TableRow className="bg-primary hover:bg-primary h-9">
                                                    <TableHead className="sticky top-0 border-r w-12 text-white font-bold py-2 text-xs bg-primary z-10">S.No</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Work Title</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">From User</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">To User</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Timeline</TableHead>
                                                    <TableHead className="sticky top-0 text-white font-bold py-2 text-xs bg-primary z-10">Reason</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredReassignment.length === 0 ? (
                                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No reassignment history found.</TableCell></TableRow>
                                                ) : filteredReassignment.map((item, index) => (
                                                    <TableRow key={`${item.id}-${index}`} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => setSelectedItem(item)}>
                                                        <TableCell className="border-r text-muted-foreground text-xs font-medium">{index + 1}</TableCell>
                                                        <TableCell className="font-medium border-r">{item.title}</TableCell>
                                                        <TableCell className="text-muted-foreground border-r">{item.previousAssigneeName || 'Unknown'}</TableCell>
                                                        <TableCell className="font-bold text-primary border-r">{item.assignedToName || 'Unknown'}</TableCell>
                                                        <TableCell className="border-r">
                                                            <div className="flex flex-col gap-0.5 text-[10px] leading-tight min-w-[120px]">
                                                                <div className="flex justify-between border-b border-muted py-0.5"><span className="text-slate-400">Assigned:</span><span>{item.originalAssignDate ? format(new Date(item.originalAssignDate), 'MMM dd, yy') : '-'}</span></div>
                                                                <div className="flex justify-between border-b border-muted py-0.5"><span className="text-blue-400">Reassigned:</span><span className="text-blue-700">{item.reassignedDate ? format(new Date(item.reassignedDate), 'MMM dd, yy') : '-'}</span></div>
                                                                {item.completedDate && <div className="flex justify-between py-0.5"><span className="text-emerald-400">Completed:</span><span className="text-emerald-700 font-bold">{format(new Date(item.completedDate), 'MMM dd, yy')}</span></div>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell><span className="text-sm italic text-muted-foreground">{item.reason || '-'}</span></TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                    </div>

                    {/* ── MOBILE CARD VIEW ── */}
                    <div className="block sm:hidden min-h-screen bg-slate-50 dark:bg-slate-950 pb-[100px] -mx-4 -mt-4 animate-in fade-in duration-300">

                        {/* Teal header — title, export, stats (matches Analytics exactly) */}
                        <div className="bg-primary px-6 pt-10 pb-16 rounded-b-[3rem] shadow-xl relative z-10 text-white">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h1 className="text-3xl font-black text-white tracking-tight">Reports</h1>
                                    <p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Administrative Overview</p>
                                </div>
                                <Button onClick={() => handleDownload('excel')}
                                    className="bg-white/20 text-white rounded-xl h-11 px-4 border-none backdrop-blur-md hover:bg-white/30"
                                    size="sm">
                                    <Download className="h-4 w-4 mr-2" />
                                    <span className="text-[11px] font-black uppercase">Export</span>
                                </Button>
                            </div>
                            {/* Stats grid */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                    <span className="text-[8px] font-black uppercase text-white/60 block mb-2">Pending</span>
                                    <p className="text-2xl font-black">{filteredPending.length}</p>
                                </div>
                                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                    <span className="text-[8px] font-black uppercase text-white/60 block mb-2">Completed</span>
                                    <p className="text-2xl font-black">{filteredCompleted.length}</p>
                                </div>
                                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                    <span className="text-[8px] font-black uppercase text-white/60 block mb-2">Reassigned</span>
                                    <p className="text-2xl font-black">{filteredReassignment.length}</p>
                                </div>
                            </div>
                        </div>

                        {/* White cards section — overlaps teal with -mt-5 */}
                        <div className="px-4 -mt-5 relative z-20 space-y-4">

                            {/* Filters card */}
                            <div className="bg-white dark:bg-card rounded-[1.5rem] p-4 shadow-xl ring-1 ring-black/5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Users className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Filters</span>
                                    {hasFilters && (
                                        <button onClick={clearFilters} className="ml-auto text-[9px] font-black text-rose-500 px-2 py-0.5 bg-rose-50 rounded-md">Clear</button>
                                    )}
                                </div>
                                <Select value={filterUser} onValueChange={setFilterUser}>
                                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 font-bold text-sm">
                                        <Users className="h-3.5 w-3.5 mr-2 text-primary" />
                                        <SelectValue placeholder="All Employees" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" side="bottom" avoidCollisions={false} className="max-h-60 overflow-y-auto rounded-xl">
                                        <SelectItem value="all" className="font-bold">All Employees</SelectItem>
                                        {allUsers.map(name => <SelectItem key={name} value={name} className="font-bold">{name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 font-bold text-sm">
                                        <Filter className="h-3.5 w-3.5 mr-2 text-primary" />
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" side="bottom" avoidCollisions={false} className="rounded-xl">
                                        <SelectItem value="all" className="font-bold">Status</SelectItem>
                                        <SelectItem value="pending" className="font-bold">Pending</SelectItem>
                                        <SelectItem value="in-progress" className="font-bold">In Progress</SelectItem>
                                        <SelectItem value="completed" className="font-bold">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                                <div className="grid grid-cols-2 gap-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="h-10 text-[10px] rounded-xl gap-1.5 px-2 font-bold bg-slate-50 border-none ring-1 ring-slate-100">
                                                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                                                {filterFromDate ? format(new Date(filterFromDate), 'MMM dd') : 'From'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-card rounded-xl" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={filterFromDate ? new Date(filterFromDate) : undefined}
                                                onSelect={(date) => setFilterFromDate(date ? format(date, 'yyyy-MM-dd') : '')}
                                                disabled={(date) => date > new Date()}
                                                className="rounded-md"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="h-10 text-[10px] rounded-xl gap-1.5 px-2 font-bold bg-slate-50 border-none ring-1 ring-slate-100">
                                                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                                                {filterToDate ? format(new Date(filterToDate), 'MMM dd') : 'To'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-card rounded-xl" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={filterToDate ? new Date(filterToDate) : undefined}
                                                onSelect={(date) => setFilterToDate(date ? format(date, 'yyyy-MM-dd') : '')}
                                                disabled={(date) => date > new Date()}
                                                className="rounded-md"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            {/* Tab selector */}
                            <div className="flex rounded-2xl overflow-hidden ring-1 ring-black/5 shadow-sm">
                                {(['all', 'pending', 'completed', 'reassignment'] as const).map(tab => (
                                    <button key={tab} onClick={() => setActiveTab(tab)}
                                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wide transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'bg-white dark:bg-card text-slate-400'}`}>
                                        {tab === 'all' ? 'All' : tab === 'pending' ? 'Pending' : tab === 'completed' ? 'Completed' : 'Reassigned'}
                                    </button>
                                ))}
                            </div>

                            {/* Cards list */}
                            <div className="space-y-2.5 pb-10">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                        {activeTab === 'all' ? 'All Work' : activeTab === 'pending' ? 'Standing Pending' : activeTab === 'completed' ? 'Completed Work' : 'Reassignment History'}
                                    </h3>
                                    <span className="text-[9px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                                        {activeTab === 'all' ? filteredAll.length : activeTab === 'pending' ? filteredPending.length : activeTab === 'completed' ? filteredCompleted.length : filteredReassignment.length}
                                    </span>
                                </div>

                                {activeTab === 'all' && (
                                    filteredAll.length === 0
                                        ? <p className="text-center text-sm text-slate-400 py-8 font-bold">No work found.</p>
                                        : filteredAll.map((item, i) => (
                                            <div key={item.id} className="bg-white dark:bg-card rounded-[1.25rem] p-4 shadow-sm ring-1 ring-black/5 active:scale-[0.98] transition-all">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="h-9 w-9 rounded-full bg-indigo-50 flex items-center justify-center font-black text-indigo-600 text-[11px] shrink-0">{i + 1}</div>
                                                        <div className="min-w-0">
                                                            <h4 className="text-[11px] font-black text-slate-800 dark:text-white truncate">{item.title}</h4>
                                                            <p className="text-[9px] font-bold text-slate-400">👤 {item.assignedToName || 'Unknown'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        {item.status === 'completed' ? (
                                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Done</span>
                                                        ) : (
                                                            <Badge variant="outline" className="capitalize text-[9px]">{item.priority || '-'}</Badge>
                                                        )}
                                                        <span className="text-[9px] text-slate-400">
                                                            {item.status === 'completed' 
                                                                ? (item.completedAt ? format(new Date(item.completedAt), 'MMM dd') : '-')
                                                                : (item.dueDate ? format(new Date(item.dueDate), 'MMM dd') : 'No Due Date')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                )}

                                {activeTab === 'pending' && (
                                    filteredPending.length === 0
                                        ? <p className="text-center text-sm text-slate-400 py-8 font-bold">No pending work found.</p>
                                        : filteredPending.map((item, i) => (
                                            <div key={item.id} className="bg-white dark:bg-card rounded-[1.25rem] p-4 shadow-sm ring-1 ring-black/5 active:scale-[0.98] transition-all">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center font-black text-amber-600 text-[11px] shrink-0">{i + 1}</div>
                                                        <div className="min-w-0">
                                                            <h4 className="text-[11px] font-black text-slate-800 dark:text-white truncate">{item.title}</h4>
                                                            <p className="text-[9px] font-bold text-slate-400">👤 {item.assignedToName || 'Unknown'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        <Badge variant="outline" className="capitalize text-[9px]">{item.priority}</Badge>
                                                        <span className="text-[9px] text-slate-400">{item.dueDate ? format(new Date(item.dueDate), 'MMM dd') : 'No Due Date'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                )}

                                {activeTab === 'completed' && (
                                    filteredCompleted.length === 0
                                        ? <p className="text-center text-sm text-slate-400 py-8 font-bold">No completed records found.</p>
                                        : filteredCompleted.map((item, i) => (
                                            <div key={item.id} className="bg-white dark:bg-card rounded-[1.25rem] p-4 shadow-sm ring-1 ring-black/5 active:scale-[0.98] transition-all">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center font-black text-emerald-600 text-[11px] shrink-0">{i + 1}</div>
                                                        <div className="min-w-0">
                                                            <h4 className="text-[11px] font-black text-slate-800 dark:text-white truncate">{item.title}</h4>
                                                            <p className="text-[9px] font-bold text-slate-400">👤 {item.assignedToName || 'Unknown'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Done</span>
                                                        <span className="text-[9px] text-slate-400">{item.completedAt ? format(new Date(item.completedAt), 'MMM dd') : '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                )}

                                {activeTab === 'reassignment' && (
                                    filteredReassignment.length === 0
                                        ? <p className="text-center text-sm text-slate-400 py-8 font-bold">No reassignment history found.</p>
                                        : filteredReassignment.map((item, i) => (
                                            <div key={`${item.id}-${i}`} className="bg-white dark:bg-card rounded-[1.25rem] p-4 shadow-sm ring-1 ring-black/5 active:scale-[0.98] transition-all">
                                                <div className="flex items-start gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center font-black text-blue-600 text-[11px] shrink-0">{i + 1}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-[11px] font-black text-slate-800 dark:text-white truncate">{item.title}</h4>
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <span className="text-[9px] text-slate-400">{item.previousAssigneeName || '?'}</span>
                                                            <ArrowRight className="h-2.5 w-2.5 text-slate-300 shrink-0" />
                                                            <span className="text-[9px] font-black text-primary">{item.assignedToName || '?'}</span>
                                                        </div>
                                                        {item.reason && <p className="text-[9px] text-slate-400 italic mt-0.5 truncate">"{item.reason}"</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
};

export default AdminReportsPage;