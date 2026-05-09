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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ClipboardList, CheckCircle2, History, ArrowRight, Download, X, Users, Calendar as CalendarIcon } from 'lucide-react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';

const AdminReportsPage: React.FC = () => {
    const [standingPending, setStandingPending] = useState<any[]>([]);
    const [pendingToCompleted, setPendingToCompleted] = useState<any[]>([]);
    const [reassignmentHistory, setReassignmentHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('pending');

    // Filters
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');
    const [filterUser, setFilterUser] = useState('all');

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
            return true;
        });
    };

    const filteredPending = useMemo(() => applyFilters(standingPending, 'dueDate'), [standingPending, filterFromDate, filterToDate, filterUser]);
    const filteredCompleted = useMemo(() => applyFilters(pendingToCompleted, 'completedAt'), [pendingToCompleted, filterFromDate, filterToDate, filterUser]);
    const filteredReassignment = useMemo(() => applyFilters(reassignmentHistory, 'originalAssignDate'), [reassignmentHistory, filterFromDate, filterToDate, filterUser]);

    const clearFilters = () => { setFilterFromDate(''); setFilterToDate(''); setFilterUser('all'); };
    const hasFilters = filterFromDate || filterToDate || filterUser !== 'all';

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

        if (activeTab === 'pending') {
            data_to_export = standingPending.map(item => ({
                Title: item.title,
                Description: item.description || '-',
                AssignedTo: item.assignedToName || 'Unknown',
                Priority: item.priority,
                DueDate: item.dueDate ? format(new Date(item.dueDate), 'yyyy-MM-dd') : '-'
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
            <div className="space-y-6 animate-in fade-in duration-500 pt-2">

                {/* Header + Filters inline — matches Analytics Dashboard style */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-4">
                    {/* Title */}
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-primary">Administrative Reports</h1>
                        <p className="text-muted-foreground font-medium">Detailed insights into work allocation, completion trends, and reassignment history.</p>
                    </div>

                    {/* Filters + Export — same row as Analytics */}
                    <div className="flex items-center gap-2 flex-nowrap">
                        {/* User filter */}
                        <Select value={filterUser} onValueChange={setFilterUser}>
                            <SelectTrigger className="h-10 rounded-xl border border-input bg-background gap-2 px-3 min-w-[160px] text-sm font-medium shadow-sm">
                                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                                <SelectValue placeholder="All Employees" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 overflow-y-auto">
                                <SelectItem value="all">All Employees</SelectItem>
                                {allUsers.map(name => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* From date */}
                        <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input type="date" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)}
                                className="h-10 text-sm rounded-xl border border-input bg-background pl-9 w-[145px] font-medium shadow-sm" />
                        </div>

                        {/* To date */}
                        <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input type="date" value={filterToDate} onChange={e => setFilterToDate(e.target.value)}
                                className="h-10 text-sm rounded-xl border border-input bg-background pl-9 w-[145px] font-medium shadow-sm" />
                        </div>

                        {/* Clear filters */}
                        {hasFilters && (
                            <Button variant="destructive" size="sm" onClick={clearFilters}
                                className="h-10 gap-1.5 rounded-xl px-3 text-sm font-medium shadow-sm shrink-0">
                                <X className="h-4 w-4" /> Clear
                            </Button>
                        )}

                        {/* Export */}
                        <Button className="h-10 gap-2 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm shadow-sm shrink-0"
                            onClick={() => handleDownload('excel')}>
                            <Download className="h-4 w-4" />
                            Export Data
                        </Button>
                    </div>
                </div>

                {/* Record count when filtered */}
                {hasFilters && (
                    <p className="text-xs text-muted-foreground font-medium -mt-4">
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
                                <TabsTrigger value="pending" className="flex-1 whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-medium transition-all">Standing Pending</TabsTrigger>
                                <TabsTrigger value="completed" className="flex-1 whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-medium transition-all">Pending to Completed</TabsTrigger>
                                <TabsTrigger value="reassignment" className="flex-1 whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-medium transition-all">Reassignment History</TabsTrigger>
                            </TabsList>
                        </div>
                        <TabsContent value="pending" className="mt-6">
                            <Card className="border-none shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-amber-500" />Standing Pending Work</CardTitle>
                                    <CardDescription>Work currently assigned but not yet completed.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                <div className="rounded-md border overflow-hidden">
                                    <div className="overflow-auto max-h-[500px]">
                                        <Table className="border-x">
                                            <TableHeader>
                                                <TableRow className="bg-primary hover:bg-primary h-9">
                                                    <TableHead className="sticky top-0 border-r w-12 text-white font-bold py-2 text-xs bg-primary z-10">S.No</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Title</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Assigned To</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Priority</TableHead>
                                                    <TableHead className="sticky top-0 text-white font-bold py-2 text-xs bg-primary z-10">Due Date</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredPending.length === 0 ? (
                                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No pending work found.</TableCell></TableRow>
                                                ) : filteredPending.map((item, index) => (
                                                    <TableRow key={item.id}>
                                                        <TableCell className="border-r text-muted-foreground text-xs font-medium">{index + 1}</TableCell>
                                                        <TableCell className="font-medium border-r">{item.title}</TableCell>
                                                        <TableCell className="border-r">{item.assignedToName || 'Unknown'}</TableCell>
                                                        <TableCell className="border-r"><Badge variant="outline" className="capitalize">{item.priority}</Badge></TableCell>
                                                        <TableCell>{item.dueDate ? format(new Date(item.dueDate), 'MMM dd, yyyy') : '-'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
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
                                <div className="rounded-md border overflow-hidden">
                                    <div className="overflow-auto max-h-[500px]">
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
                                                    <TableRow key={item.id}>
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
                                </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="reassignment" className="mt-6">
                            <Card className="border-none shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-blue-500" />Reassignment History</CardTitle>
                                    <CardDescription>Audit trail of work items reassigned between users.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                <div className="rounded-md border overflow-hidden">
                                    <div className="overflow-auto max-h-[500px]">
                                        <Table className="border-x">
                                            <TableHeader>
                                                <TableRow className="bg-primary hover:bg-primary h-9">
                                                    <TableHead className="sticky top-0 border-r w-12 text-white font-bold py-2 text-xs bg-primary z-10">S.No</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Work Title</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">From User</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-center w-[50px] text-white font-bold py-2 text-xs bg-primary z-10"></TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">To User</TableHead>
                                                    <TableHead className="sticky top-0 border-r text-white font-bold py-2 text-xs bg-primary z-10">Timeline</TableHead>
                                                    <TableHead className="sticky top-0 text-white font-bold py-2 text-xs bg-primary z-10">Reason</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredReassignment.length === 0 ? (
                                                    <TableRow><TableCell colSpan={7} className="h-24 text-center">No reassignment history found.</TableCell></TableRow>
                                                ) : filteredReassignment.map((item, index) => (
                                                    <TableRow key={`${item.id}-${index}`}>
                                                        <TableCell className="border-r text-muted-foreground text-xs font-medium">{index + 1}</TableCell>
                                                        <TableCell className="font-medium border-r">{item.title}</TableCell>
                                                        <TableCell className="text-muted-foreground border-r">{item.previousAssigneeName || 'Unknown'}</TableCell>
                                                        <TableCell className="border-r"><ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" /></TableCell>
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
                                </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                    </div>

                    {/* ── MOBILE CARD VIEW ── */}
                    <div className="block sm:hidden space-y-4">
                        {/* Mobile tab selector */}
                        <div className="flex rounded-xl overflow-hidden border border-input">
                            {(['pending', 'completed', 'reassignment'] as const).map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'bg-background text-muted-foreground'}`}>
                                    {tab === 'pending' ? 'Pending' : tab === 'completed' ? 'Completed' : 'Reassigned'}
                                </button>
                            ))}
                        </div>

                        {/* Mobile cards — Pending */}
                        {activeTab === 'pending' && (
                            filteredPending.length === 0
                                ? <p className="text-center text-sm text-muted-foreground py-8">No pending work found.</p>
                                : filteredPending.map((item, i) => (
                                    <div key={item.id} className="bg-card rounded-2xl p-4 shadow-sm ring-1 ring-black/5 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <span className="text-[10px] text-muted-foreground font-bold">#{i + 1}</span>
                                                <p className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{item.title}</p>
                                            </div>
                                            <Badge variant="outline" className="capitalize shrink-0">{item.priority}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-slate-50">
                                            <span>👤 {item.assignedToName || 'Unknown'}</span>
                                            <span>📅 {item.dueDate ? format(new Date(item.dueDate), 'MMM dd, yyyy') : '-'}</span>
                                        </div>
                                    </div>
                                ))
                        )}

                        {/* Mobile cards — Completed */}
                        {activeTab === 'completed' && (
                            filteredCompleted.length === 0
                                ? <p className="text-center text-sm text-muted-foreground py-8">No completed work records found.</p>
                                : filteredCompleted.map((item, i) => (
                                    <div key={item.id} className="bg-card rounded-2xl p-4 shadow-sm ring-1 ring-black/5 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <span className="text-[10px] text-muted-foreground font-bold">#{i + 1}</span>
                                                <p className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{item.title}</p>
                                            </div>
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">Done</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-slate-50">
                                            <span>👤 {item.assignedToName || 'Unknown'}</span>
                                            <span>✅ {item.completedAt ? format(new Date(item.completedAt), 'MMM dd, yyyy') : '-'}</span>
                                        </div>
                                        {item.duration && <p className="text-[11px] text-muted-foreground">⏱ {item.duration}</p>}
                                    </div>
                                ))
                        )}

                        {/* Mobile cards — Reassignment */}
                        {activeTab === 'reassignment' && (
                            filteredReassignment.length === 0
                                ? <p className="text-center text-sm text-muted-foreground py-8">No reassignment history found.</p>
                                : filteredReassignment.map((item, i) => (
                                    <div key={`${item.id}-${i}`} className="bg-card rounded-2xl p-4 shadow-sm ring-1 ring-black/5 space-y-2">
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-bold">#{i + 1}</span>
                                            <p className="font-bold text-sm text-slate-800 dark:text-white mt-0.5">{item.title}</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-muted-foreground">{item.previousAssigneeName || 'Unknown'}</span>
                                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                            <span className="font-bold text-primary">{item.assignedToName || 'Unknown'}</span>
                                        </div>
                                        {item.reason && <p className="text-[11px] text-muted-foreground italic">"{item.reason}"</p>}
                                    </div>
                                ))
                        )}
                    </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
};

export default AdminReportsPage;