import React, { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  CalendarIcon,
  Plus,
  Trash2,
  Save,
  Clock,
  FileText,
  Search,
  PencilLine,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface WorkRow {
  id: string;
  workCode: string;
  workDescription: string;
  timeSpent: string;
  clientId: string;
  status: 'completed' | 'pending';
  dueDate: string;
  adminDueDate?: string;
  otherClientName?: string;
  otherClientLogoUrl?: string;
  otherWorkTitle?: string;
  workTitle?: string; // Add workTitle to track the selected work name
  quantity?: number;
}

const createEmptyRows = (count: number, startingIndex: number = 0): WorkRow[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${startingIndex + i}-${Date.now()}`,
    workCode: '',
    workDescription: '',
    timeSpent: '0h 0m',
    clientId: '',
    status: 'completed',
    dueDate: '',
    otherClientName: '',
    otherClientLogoUrl: '',
    otherWorkTitle: '',
    quantity: 0,
  }));
};

const DailyReport: React.FC = () => {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<WorkRow[]>(createEmptyRows(10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableWorks, setAvailableWorks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [autoFilledRowIds, setAutoFilledRowIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const scrollTable = (direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const scrollAmount = 300;
      tableContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [worksRes, clientsRes, tasksRes] = await Promise.all([
          api.works.getActive(),
          api.clients.getAll(),
          api.allocations.getMyTasks()
        ]);

        if (worksRes.success && worksRes.data) {
          setAvailableWorks(worksRes.data);
        }
        if (clientsRes.success && clientsRes.data) {
          setClients(clientsRes.data);
        }

        // LOAD FROM LOCAL STORAGE FIRST
        const storageKey = `daily_report_${user?.id}_${format(date, 'yyyy-MM-dd')}`;
        const savedData = localStorage.getItem(storageKey);

        if (savedData) {
          try {
            const parsedRows = JSON.parse(savedData);
            if (Array.isArray(parsedRows) && parsedRows.length > 0) {
              setRows(parsedRows);
              return; // Skip auto-fill if we have saved data
            }
          } catch (e) {
            console.error("Error parsing saved rows:", e);
          }
        }

        // Auto-fill logic (only if no saved data)
        if (tasksRes.success && tasksRes.data) {
          const tasksToFill = tasksRes.data.filter((task: any) => {
            return task.status === 'in-progress' || task.status === 'pending';
          });

          if (tasksToFill.length > 0) {
            const newRows: WorkRow[] = tasksToFill.map((task: any, index: number) => ({
              id: `autofill-${task.id}-${Date.now()}`,
              workCode: task.workCode || 'OTHERS',
              workDescription: '',
              workTitle: task.workTitle || task.title || '',
              timeSpent: task.duration || '0h 0m',
              clientId: task.clientId?.toString() || '',
              status: task.status === 'completed' ? 'completed' : 'pending',
              dueDate: task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
              adminDueDate: task.dueDate,
              quantity: 0
            }));

            setRows(prev => {
              const filledRowIds = new Set(newRows.map(r => r.id));
              setAutoFilledRowIds(filledRowIds);

              const combined = [...newRows];
              if (combined.length < 10) {
                combined.push(...createEmptyRows(10 - combined.length, combined.length));
              }
              return combined;
            });

            toast.success(`Pre-filled ${tasksToFill.length} tasks from your allocation`);
          } else {
            setRows(createEmptyRows(10));
          }
        } else {
          setRows(createEmptyRows(10));
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [date, user?.id]);

  // Auto-save to local storage
  useEffect(() => {
    if (isLoadingData) return;
    const storageKey = `daily_report_${user?.id}_${format(date, 'yyyy-MM-dd')}`;
    localStorage.setItem(storageKey, JSON.stringify(rows));
  }, [rows, date, user?.id, isLoadingData]);

  const handleManualSave = (index: number) => {
    const storageKey = `daily_report_${user?.id}_${format(date, 'yyyy-MM-dd')}`;
    localStorage.setItem(storageKey, JSON.stringify(rows));
    toast.success(`Row ${index + 1} saved successfully`);
  };

  const filteredWorks = availableWorks.filter(
    (work) =>
      work.workTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      work.workCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (work.workType && work.workType.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDescriptionChange = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, workDescription: value } : row
      )
    );
    setSearchTerm(value);
    setActiveDropdown(id);
  };

  const handleSelectWork = (id: string, work: any) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, workCode: work.workCode, workTitle: work.workTitle, workDescription: '' } // Maintain title, clear description
          : row
      )
    );
    setActiveDropdown(null);
    setSearchTerm('');
  };

  const handleTimeUpdate = (id: string, type: 'h' | 'm', value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const currentTime = row.timeSpent || '0h 0m';
          let hours = currentTime.includes('h') ? currentTime.split('h')[0].trim() : '0';
          let minutes = currentTime.includes('m') ? currentTime.split('h')[1]?.split('m')[0].trim() || '0' : '0';

          if (type === 'h') hours = value;
          if (type === 'm') minutes = value;

          return { ...row, timeSpent: `${hours}h ${minutes}m` };
        }
        return row;
      })
    );
  };

  const getTimeParts = (timeStr: string) => {
    if (!timeStr) return { h: '0', m: '0' };
    const hMatch = timeStr.match(/(\d+)\s*h/);
    const mMatch = timeStr.match(/(\d+)\s*m/);
    return {
      h: hMatch ? hMatch[1] : '0',
      m: mMatch ? mMatch[1] : '0'
    };
  };

  const handleCodeChange = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, workCode: value } : row))
    );
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        workCode: '',
        workDescription: '',
        timeSpent: '0h 0m',
        clientId: '',
        status: 'completed',
        dueDate: '',
        quantity: 0
      },
    ]);
  };

  const handleRowUpdate = (id: string, updates: Partial<WorkRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const updatedRow = { ...row, ...updates };
          if (updates.clientId && updates.clientId !== 'others') {
            updatedRow.otherClientName = '';
            updatedRow.otherClientLogoUrl = '';
          }
          if (updates.workCode && updates.workCode !== 'OTHERS') {
            updatedRow.otherWorkTitle = '';
          }
          return updatedRow;
        }
        return row;
      })
    );
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) {
      toast.error('You must have at least one row');
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== id));
    setAutoFilledRowIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const clearAutoFilledRows = () => {
    setRows((prev) => {
      const manualRows = prev.filter((row) => !autoFilledRowIds.has(row.id));
      const emptyRowsNeeded = Math.max(0, 10 - manualRows.length);
      return [...manualRows, ...createEmptyRows(emptyRowsNeeded, manualRows.length)];
    });
    setAutoFilledRowIds(new Set());
    toast.success('Auto-filled entries cleared');
  };

  const handleSubmit = async () => {
    const filledRows = rows.filter((row) =>
      row.workDescription.trim() || row.workCode === 'OTHERS'
    );

    if (filledRows.length === 0) {
      toast.error('Please add at least one work entry');
      return;
    }

    setIsSubmitting(true);

    try {
      const reportData = {
        date: format(date, 'yyyy-MM-dd'),
        entries: filledRows.map(row => ({
          workCode: row.workCode,
          workTitle: row.workCode === 'OTHERS' ? (row.otherWorkTitle || 'Manual Entry') : (row.workTitle || (row.workDescription.includes('] ') ? row.workDescription.split('] ')[1] : row.workDescription)),
          description: row.workDescription,
          timeSpent: row.timeSpent,
          clientId: (row.clientId && row.clientId !== 'others') ? parseInt(row.clientId) : null,
          newClientName: row.clientId === 'others' ? row.otherClientName : null,
          newClientLogoUrl: row.clientId === 'others' ? row.otherClientLogoUrl : null,
          status: row.status,
          dueDate: row.dueDate ? row.dueDate : (row.status === 'pending' ? format(new Date(), 'yyyy-MM-dd') : null),
          quantity: row.quantity || 0
        }))
      };

      const response = await api.reports.submit(reportData);

      if (response.success) {
        toast.success(response.message || 'Daily report submitted successfully!');
        setRows(createEmptyRows(10));
        const storageKey = `daily_report_${user?.id}_${format(date, 'yyyy-MM-dd')}`;
        localStorage.removeItem(storageKey); // Clear local storage on successful submit
      } else {
        toast.error(response.message || 'Failed to submit report');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred during submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filledRowsCount = rows.filter((row) => row.workDescription.trim()).length;
  const hasOthersWork = rows.some(r => r.workCode === 'OTHERS');
  const hasOthersClient = rows.some(r => r.clientId === 'others');

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Daily Report</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Log your daily activities and time spent</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[240px] justify-start text-left font-normal bg-card h-10 px-3">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'MMM dd, yyyy') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {autoFilledRowIds.size > 0 && (
              <Button
                variant="outline"
                onClick={clearAutoFilledRows}
                className="gap-2 h-10 px-4 border-dashed"
              >
                <Trash2 className="h-4 w-4" />
                Clear Auto-filled ({autoFilledRowIds.size})
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || filledRowsCount === 0}
              className="gap-2 btn-gradient h-10 px-6 rounded-xl border-none"
            >
              {isSubmitting ? 'Submitting...' : (
                <>
                  <Save className="h-4 w-4" />
                  Submit Report
                </>
              )}
            </Button>
          </div>
        </div>

        <Card className="border shadow-xl overflow-hidden rounded-xl">
          <CardHeader className="bg-muted/50 pb-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Work Entries
                </CardTitle>
                <CardDescription>Enter details for each task performed today</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden lg:flex items-center gap-1 bg-background/50 p-1 rounded-lg border border-primary/10">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => scrollTable('left')} title="Scroll Left">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="h-4 w-px bg-border mx-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => scrollTable('right')} title="Scroll Right">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm font-medium text-muted-foreground mr-4">
                  Filled rows: <span className="text-primary">{filledRowsCount}</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop View (Table) */}
            <div className="hidden lg:block overflow-x-auto relative" ref={tableContainerRef}>
              <Table className="min-w-[1300px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 italic text-muted-foreground">#</TableHead>
                    <TableHead className="w-52">Work / Code</TableHead>
                    {hasOthersWork && <TableHead className="w-52 animate-in slide-in-from-left-2 duration-300">Manual Work</TableHead>}
                    <TableHead className="w-auto min-w-[300px]">Description</TableHead>
                    <TableHead className="w-24 text-center">Count</TableHead>
                    <TableHead className="w-32">Time Spent</TableHead>
                    <TableHead className="w-40">Client</TableHead>
                    {hasOthersClient && <TableHead className="w-40 animate-in slide-in-from-left-2 duration-300">New Client</TableHead>}
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="w-32">Due Date</TableHead>
                    <TableHead className="w-24 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium align-top">{index + 1}</TableCell>
                      <TableCell className="align-top">
                        <div className="relative" ref={activeDropdown === `work-${row.id}` ? dropdownRef : null}>
                          <div className="flex gap-1.5 h-10">
                            <Button
                              variant={row.workCode === 'OTHERS' ? 'default' : 'outline'}
                              size="icon"
                              className="h-10 w-10 shrink-0"
                              onClick={() => {
                                if (row.workCode === 'OTHERS') {
                                  handleRowUpdate(row.id, { workCode: '', otherWorkTitle: '' });
                                } else {
                                  handleRowUpdate(row.id, { workCode: 'OTHERS', workDescription: '' });
                                }
                              }}
                              title="Manual Entry"
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <div
                              className={cn(
                                "flex-1 border rounded-md px-3 py-2 text-sm bg-background/50 hover:bg-background cursor-pointer transition-colors flex items-center justify-between truncate",
                                row.workCode ? "border-primary/30" : "border-input",
                                row.workCode === 'OTHERS' && "opacity-50 pointer-events-none"
                              )}
                              onClick={() => {
                                setActiveDropdown(activeDropdown === `work-${row.id}` ? null : `work-${row.id}`);
                                setSearchTerm('');
                              }}
                            >
                              <span className="truncate">
                                {row.workCode === 'OTHERS' ? "Custom Work" : (row.workCode ? `[${row.workCode}] ${row.workTitle || ''}` : "Select Work")}
                              </span>
                            </div>
                          </div>

                          {activeDropdown === `work-${row.id}` && (
                            <div className="absolute z-50 mt-1 w-full min-w-[300px] rounded-md border bg-popover p-2 text-popover-foreground shadow-2xl animate-in fade-in zoom-in-95">
                              <div className="flex items-center border-b px-2 pb-2 mb-2">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                  className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                  placeholder="Search work or code..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  autoFocus
                                />
                              </div>
                              <div className="max-h-[200px] overflow-y-auto scrollbar-thin">
                                {filteredWorks.map((work) => (
                                  <div
                                    key={work.id}
                                    className="relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                    onClick={() => handleSelectWork(row.id, work)}
                                  >
                                    <span className="font-semibold text-primary mr-2">[{work.workCode}]</span>
                                    <span>{work.workTitle}</span>
                                  </div>
                                ))}
                                {filteredWorks.length === 0 && (
                                  <div className="py-6 text-center text-sm text-muted-foreground">No work found.</div>
                                )}
                                <div className="border-t mt-2 pt-2">
                                  <div
                                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm font-medium text-primary hover:bg-accent"
                                    onClick={() => handleRowUpdate(row.id, { workCode: 'OTHERS', workDescription: '' })}
                                  >
                                    Others (Manual Entry)
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {hasOthersWork && (
                        <TableCell className="align-top pt-3 w-52 animate-in slide-in-from-left-2 duration-300">
                          <Input
                            placeholder="Type Work Title..."
                            className="h-10 text-xs border-primary/40 bg-white font-bold text-primary shadow-inner"
                            value={row.otherWorkTitle || ''}
                            onChange={(e) => handleRowUpdate(row.id, { otherWorkTitle: e.target.value })}
                          />
                        </TableCell>
                      )}
                      <TableCell className="align-top pt-3 min-w-[300px]">
                        <textarea
                          placeholder="What did you work on?..."
                          className="description-textarea resize-none"
                          value={row.workDescription}
                          onChange={(e) => {
                            handleDescriptionChange(row.id, e.target.value);
                            // Auto-resize
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          onFocus={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          rows={1}
                        />
                      </TableCell>
                      <TableCell className="align-top pt-3 w-24">
                        <Input
                          type="number"
                          min="0"
                          className="h-11 text-center font-black text-black border-2 border-primary/60 bg-white shadow-md placeholder:text-slate-400 focus-visible:ring-primary px-2"
                          value={row.quantity || ''}
                          onChange={(e) => handleRowUpdate(row.id, { quantity: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="align-top pt-3 w-32">
                        <div className="flex items-center gap-1.5 h-10">
                          <select
                            value={getTimeParts(row.timeSpent).h}
                            onChange={(e) => handleTimeUpdate(row.id, 'h', e.target.value)}
                            className="bg-white border-2 border-primary/40 rounded-md px-2 h-11 text-sm w-full font-black text-slate-900 appearance-none cursor-pointer shadow-sm"
                          >
                            {Array.from({ length: 13 }, (_, i) => (<option key={i} value={i} className="text-slate-900">{i}h</option>))}
                          </select>
                          <select
                            value={getTimeParts(row.timeSpent).m}
                            onChange={(e) => handleTimeUpdate(row.id, 'm', e.target.value)}
                            className="bg-white border-2 border-primary/40 rounded-md px-2 h-11 text-sm w-full font-black text-slate-900 appearance-none cursor-pointer shadow-sm"
                          >
                            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (<option key={m} value={m} className="text-slate-900">{m}m</option>))}
                          </select>
                        </div>
                      </TableCell>
                      <TableCell className="align-top pt-3">
                        <div className="flex gap-1.5 h-10">
                          <Button
                            variant={row.clientId === 'others' ? 'default' : 'outline'}
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={() => {
                              if (row.clientId === 'others') {
                                handleRowUpdate(row.id, { clientId: '', otherClientName: '' });
                              } else {
                                handleRowUpdate(row.id, { clientId: 'others' });
                              }
                            }}
                            title="New Client"
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Select
                            value={row.clientId}
                            onValueChange={(val) => handleRowUpdate(row.id, { clientId: val })}
                            disabled={row.clientId === 'others'}
                          >
                            <SelectTrigger className="h-10 overflow-hidden"><SelectValue placeholder="Client" /></SelectTrigger>
                            <SelectContent>
                              {clients.map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                              ))}
                              <SelectItem value="others">Others</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      {hasOthersClient && (
                        <TableCell className="align-top pt-3 w-44 animate-in slide-in-from-left-2 duration-300">
                          <Input
                            placeholder="New Client Name..."
                            className="h-10 text-xs border-primary/40 bg-white font-bold text-primary shadow-inner"
                            value={row.otherClientName || ''}
                            onChange={(e) => handleRowUpdate(row.id, { otherClientName: e.target.value })}
                          />
                        </TableCell>
                      )}
                      <TableCell className="align-top pt-3">
                        <Select value={row.status} onValueChange={(val: 'completed' | 'pending') => handleRowUpdate(row.id, { status: val })}>
                          <SelectTrigger className={cn("h-10 text-[10px]", row.status === 'completed' ? "text-success" : "text-warning")}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="completed">Done</SelectItem>
                            <SelectItem value="pending">To Do</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top pt-3">
                        {row.status === 'pending' ? (
                          <Input
                            type="date"
                            className="h-10"
                            value={row.dueDate}
                            onChange={(e) => handleRowUpdate(row.id, { dueDate: e.target.value })}
                            min={format(new Date(), 'yyyy-MM-dd')}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground italic">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center align-top pt-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleManualSave(index)}
                            className="text-primary hover:text-primary hover:bg-primary/10 h-8 w-8"
                            title="Save Row"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(row.id)}
                            className="text-muted-foreground hover:text-destructive h-8 w-8"
                            title="Remove Row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="lg:hidden divide-y">
              {rows.map((row, index) => (
                <div key={row.id} className="p-4 space-y-4 bg-background">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">Entry #{index + 1}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManualSave(index)}
                        className="h-7 px-2 text-[10px] gap-1 border-primary/30 text-primary"
                      >
                        <Save className="h-3 w-3" /> Save
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeRow(row.id)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>

                  {/* Work Selector */}
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Work / Activity</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={row.workCode === 'OTHERS' ? 'default' : 'outline'}
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        onClick={() => {
                          if (row.workCode === 'OTHERS') {
                            handleRowUpdate(row.id, { workCode: '', otherWorkTitle: '' });
                          } else {
                            handleRowUpdate(row.id, { workCode: 'OTHERS', workDescription: '' });
                          }
                        }}
                      >
                        <PencilLine className="h-4 w-4" />
                      </Button>
                      <div className="relative flex-1" ref={activeDropdown === `work-${row.id}` ? mobileDropdownRef : null}>
                        <div
                          className={cn(
                            "border rounded-md px-3 py-2 text-sm bg-muted/30 min-h-[44px] flex items-center justify-between",
                            row.workCode === 'OTHERS' && "opacity-50 pointer-events-none"
                          )}
                          onClick={() => {
                            setActiveDropdown(activeDropdown === `work-${row.id}` ? null : `work-${row.id}`);
                            setSearchTerm('');
                          }}
                        >
                          <span className="truncate">{row.workCode === 'OTHERS' ? "Custom Work" : (row.workCode ? `[${row.workCode}] ${row.workTitle || ''}` : "Select Work")}</span>
                          <Search className="h-4 w-4 opacity-30" />
                        </div>
                        {activeDropdown === `work-${row.id}` && (
                          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-2xl p-2 animate-in fade-in zoom-in-95">
                            <div className="flex items-center border-b px-2 pb-2 mb-2">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <input
                                className="flex h-10 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                placeholder="Search work or code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                              />
                            </div>
                            <div className="max-h-[250px] overflow-y-auto">
                              {filteredWorks.map((work) => (
                                <div key={work.id} className="p-3 border-b last:border-0 text-sm active:bg-accent hover:bg-accent rounded-sm transition-colors" onClick={() => handleSelectWork(row.id, work)}>
                                  <span className="font-bold text-primary mr-2">[{work.workCode}]</span> {work.workTitle}
                                </div>
                              ))}
                              {filteredWorks.length === 0 && (
                                <div className="p-4 text-center text-sm text-muted-foreground">No work matching "{searchTerm}"</div>
                              )}
                              <div className="p-3 text-primary font-bold border-t mt-1 flex items-center gap-2 hover:bg-primary/5 rounded-sm transition-colors" onClick={() => handleRowUpdate(row.id, { workCode: 'OTHERS', workDescription: '' })}>
                                <Plus className="h-4 w-4" /> Others (Manual Entry)
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {row.workCode === 'OTHERS' && (
                      <Input
                        placeholder="Enter Work Title (e.g. Server Maintenance)"
                        className="text-sm border-primary/20 mt-2"
                        value={row.otherWorkTitle || ''}
                        onChange={(e) => handleRowUpdate(row.id, { otherWorkTitle: e.target.value })}
                      />
                    )}
                  </div>

                  {/* Description - Added for Mobile */}
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Description</Label>
                    <textarea
                      placeholder="Activity description..."
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                      value={row.workDescription}
                      onChange={(e) => handleDescriptionChange(row.id, e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Count</Label>
                      <Input type="number" className="h-11" value={row.quantity || ''} onChange={(e) => handleRowUpdate(row.id, { quantity: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Hours</Label>
                      <div className="flex gap-1">
                        <select className="flex-1 h-11 border rounded-md px-2" value={getTimeParts(row.timeSpent).h} onChange={(e) => handleTimeUpdate(row.id, 'h', e.target.value)}>
                          {Array.from({ length: 13 }, (_, i) => (<option key={i} value={i}>{i}h</option>))}
                        </select>
                        <select className="flex-1 h-11 border rounded-md px-2" value={getTimeParts(row.timeSpent).m} onChange={(e) => handleTimeUpdate(row.id, 'm', e.target.value)}>
                          {[0, 15, 30, 45].map((m) => (<option key={m} value={m}>{m}m</option>))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Client</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={row.clientId === 'others' ? 'default' : 'outline'}
                          size="icon"
                          className="h-11 w-11 shrink-0"
                          onClick={() => {
                            if (row.clientId === 'others') {
                              handleRowUpdate(row.id, { clientId: '', otherClientName: '' });
                            } else {
                              handleRowUpdate(row.id, { clientId: 'others' });
                            }
                          }}
                        >
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        <Select
                          value={row.clientId}
                          onValueChange={(val) => handleRowUpdate(row.id, { clientId: val })}
                          disabled={row.clientId === 'others'}
                        >
                          <SelectTrigger className="h-11 flex-1"><SelectValue placeholder="Client" /></SelectTrigger>
                          <SelectContent>
                            {clients.map(c => (<SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>))}
                            <SelectItem value="others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {row.clientId === 'others' && (
                        <Input
                          placeholder="New Client Name"
                          className="h-11 mt-2 text-sm"
                          value={row.otherClientName || ''}
                          onChange={(e) => handleRowUpdate(row.id, { otherClientName: e.target.value })}
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                      <Select value={row.status} onValueChange={(val: 'completed' | 'pending') => handleRowUpdate(row.id, { status: val })}>
                        <SelectTrigger className={cn("h-11", row.status === 'completed' ? "text-emerald-600" : "text-amber-600")}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">To Do</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>

                  {row.status === 'pending' && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Date</Label>
                      <Input
                        type="date"
                        className="h-11"
                        value={row.dueDate}
                        onChange={(e) => handleRowUpdate(row.id, { dueDate: e.target.value })}
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-6 bg-muted/20 border-t">
              <Button
                variant="outline"
                className="w-full border-dashed border-2 py-6 sm:py-8 flex flex-col gap-2 h-auto"
                onClick={addRow}
              >
                <Plus className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">Add New Entry Row</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DailyReport;
