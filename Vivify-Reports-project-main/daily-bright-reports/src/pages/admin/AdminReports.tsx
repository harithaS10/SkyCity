import React, { useState, useEffect } from 'react';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Loader2, ClipboardList, CheckCircle2, History, ArrowRight, Download, FileSpreadsheet, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const AdminReportsPage: React.FC = () => {
    const [standingPending, setStandingPending] = useState<any[]>([]);
    const [pendingToCompleted, setPendingToCompleted] = useState<any[]>([]);
    const [reassignmentHistory, setReassignmentHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('pending');

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteType, setDeleteType] = useState<'completed' | 'reassignment' | null>(null);

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

    const handleDeleteClick = () => {
        if (activeTab === 'completed') {
            setDeleteType('completed');
            setIsDeleteDialogOpen(true);
        } else if (activeTab === 'reassignment') {
            setDeleteType('reassignment');
            setIsDeleteDialogOpen(true);
        }
    }

    const confirmDelete = async () => {
        try {
            let res;
            if (deleteType === 'completed') {
                res = await api.admin.clearCompletedReports();
            } else if (deleteType === 'reassignment') {
                res = await api.admin.clearReassignmentHistory();
            }

            if (res && res.success) {
                toast.success(res.message);
                fetchReports();
            } else {
                toast.error("Failed to clear data.");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while clearing data.");
        } finally {
            setIsDeleteDialogOpen(false);
            setDeleteType(null);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-8 animate-in fade-in duration-500 pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Administrative Reports</h1>
                        <p className="text-sm text-muted-foreground max-w-[600px]">
                            Detailed insights into work allocation, completion trends, and reassignment history.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {(activeTab === 'completed' || activeTab === 'reassignment') && (
                            <Button variant="destructive" className="gap-2 h-10 px-4 rounded-xl shadow-sm border-none" onClick={handleDeleteClick}>
                                <Trash2 className="h-4 w-4" />
                                <span className="font-semibold">Clear History</span>
                            </Button>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="gap-2 h-10 px-4 rounded-xl bg-primary shadow-lg shadow-primary/20 border-none">
                                    <Download className="h-4 w-4" />
                                    <span className="font-semibold">Export {activeTab === 'pending' ? 'Pending' : activeTab === 'completed' ? 'Completed' : 'History'}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={() => handleDownload('excel')} className="cursor-pointer py-2">
                                    <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                                    <span>Export as Excel</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownload('csv')} className="cursor-pointer py-2">
                                    <FileText className="mr-2 h-4 w-4 text-primary" />
                                    <span>Export as CSV</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
                            <TabsList className="inline-flex w-auto min-w-full lg:min-w-[600px] h-11 bg-muted/50 p-1">
                                <TabsTrigger value="pending" className="flex-1 whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-medium transition-all">
                                    Standing Pending
                                </TabsTrigger>
                                <TabsTrigger value="completed" className="flex-1 whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-medium transition-all">
                                    Pending to Completed
                                </TabsTrigger>
                                <TabsTrigger value="reassignment" className="flex-1 whitespace-nowrap px-4 py-2 text-xs sm:text-sm font-medium transition-all">
                                    Reassignment History
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="pending" className="mt-6">
                            <Card className="border-none shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ClipboardList className="h-5 w-5 text-amber-500" />
                                        Standing Pending Work
                                    </CardTitle>
                                    <CardDescription>Work currently assigned but not yet completed.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-md border">
                                        <Table className="border-x">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="border-r">Title</TableHead>
                                                    <TableHead className="border-r">Assigned To</TableHead>
                                                    <TableHead className="border-r">Priority</TableHead>
                                                    <TableHead>Due Date</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {standingPending.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-24 text-center">No pending work found.</TableCell>
                                                    </TableRow>
                                                ) : (
                                                    standingPending.map((item) => (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="font-medium border-r">{item.title}</TableCell>
                                                            <TableCell className="border-r">{item.assignedToName || 'Unknown'}</TableCell>
                                                            <TableCell className="border-r">
                                                                <Badge variant="outline" className="capitalize">{item.priority}</Badge>
                                                            </TableCell>
                                                            <TableCell>{item.dueDate ? format(new Date(item.dueDate), 'MMM dd, yyyy') : '-'}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="completed" className="mt-6">
                            <Card className="border-none shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                        Pending to Completed Work
                                    </CardTitle>
                                    <CardDescription>Work items that have been successfully completed.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-md border">
                                        <Table className="border-x">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="border-r">Title</TableHead>
                                                    <TableHead className="border-r">Completed By</TableHead>
                                                    <TableHead className="border-r">Completion Date</TableHead>
                                                    <TableHead>Duration</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {pendingToCompleted.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-24 text-center">No completed work records found.</TableCell>
                                                    </TableRow>
                                                ) : (
                                                    pendingToCompleted.map((item) => (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="font-medium border-r">{item.title}</TableCell>
                                                            <TableCell className="border-r">{item.assignedToName || 'Unknown'}</TableCell>
                                                            <TableCell className="border-r">{item.completedAt ? format(new Date(item.completedAt), 'MMM dd, yyyy') : '-'}</TableCell>
                                                            <TableCell className="text-muted-foreground text-xs italic">{item.duration || '-'}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="reassignment" className="mt-6">
                            <Card className="border-none shadow-md">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <History className="h-5 w-5 text-blue-500" />
                                        Reassignment History
                                    </CardTitle>
                                    <CardDescription>Audit trail of work items reassigned between users.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-md border">
                                        <Table className="border-x">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="border-r">Work Title</TableHead>
                                                    <TableHead className="border-r">From User</TableHead>
                                                    <TableHead className="border-r text-center w-[50px]"></TableHead>
                                                    <TableHead className="border-r">To User</TableHead>
                                                    <TableHead className="border-r">Timeline</TableHead>
                                                    <TableHead>Reason</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reassignmentHistory.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="h-24 text-center">No reassignment history found.</TableCell>
                                                    </TableRow>
                                                ) : (
                                                    reassignmentHistory.map((item, index) => (
                                                        <TableRow key={`${item.id}-${index}`}>
                                                            <TableCell className="font-medium border-r">{item.title}</TableCell>
                                                            <TableCell className="text-muted-foreground border-r">{item.previousAssigneeName || 'Unknown'}</TableCell>
                                                            <TableCell className="border-r"><ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" /></TableCell>
                                                            <TableCell className="font-bold text-primary border-r">{item.assignedToName || 'Unknown'}</TableCell>
                                                            <TableCell className="border-r">
                                                                <div className="flex flex-col gap-0.5 text-[10px] leading-tight min-w-[120px]">
                                                                    <div className="flex justify-between border-b border-muted py-0.5">
                                                                        <span className="text-slate-400">Assigned:</span>
                                                                        <span>{item.originalAssignDate ? format(new Date(item.originalAssignDate), 'MMM dd, yy') : '-'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between border-b border-muted py-0.5">
                                                                        <span className="text-blue-400">Reassigned:</span>
                                                                        <span className="text-blue-700">{item.reassignedDate ? format(new Date(item.reassignedDate), 'MMM dd, yy') : '-'}</span>
                                                                    </div>
                                                                    {item.completedDate && (
                                                                        <div className="flex justify-between py-0.5">
                                                                            <span className="text-emerald-400">Completed:</span>
                                                                            <span className="text-emerald-700 font-bold">{format(new Date(item.completedDate), 'MMM dd, yy')}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="text-sm italic text-muted-foreground">{item.reason || '-'}</span>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                )}

                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete all
                                {deleteType === 'completed' ? ' completed work records ' : ' reassignment history '}
                                from the database.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Continue
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    );
};

export default AdminReportsPage;