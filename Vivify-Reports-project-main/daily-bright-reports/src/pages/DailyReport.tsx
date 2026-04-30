import React, { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
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
  CheckCircle2,
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
  status: 'completed' | 'pending' | 'in-progress';
  dueDate: string;
  adminDueDate?: string;
  otherClientName?: string;
  otherClientLogoUrl?: string;
  otherWorkTitle?: string;
  workTitle?: string; // Add workTitle to track the selected work name
  quantity?: number;
}

const createEmptyRows = (count: number, startingIndex: number = 0): WorkRow[] => {
  const today = new Date().toISOString().split('T')[0]; // yyyy-MM-dd
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${startingIndex + i}-${Date.now()}`,
    workCode: '',
    workDescription: '',
    timeSpent: '0h 0m',
    clientId: '',
    status: 'in-progress' as const,
    dueDate: today,
    otherClientName: '',
    otherClientLogoUrl: '',
    otherWorkTitle: '',
    quantity: 0,
  }));
};

const DailyReport: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const canView = user?.role === 'staff' ? hasPermission('daily_reports', 'view') : true;
  const canCreate = user?.role === 'staff' ? hasPermission('daily_reports', 'create') : true;

  // Redirect if no view permission
  React.useEffect(() => {
    if (!canView) {
      navigate('/dashboard');
    }
  }, [canView, navigate]);
  const [date, setDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const isCalendarOpenRef = React.useRef(false);
  const handleCalendarOpen = (open: boolean) => {
    setIsCalendarOpen(open);
    isCalendarOpenRef.current = open;
  };
  const [rows, setRows] = useState<WorkRow[]>(createEmptyRows(10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
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

  // Close dropdown when table scrolls
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (activeDropdown) {
        setActiveDropdown(null);
        setDropdownPos(null);
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close work dropdown if calendar popover is open
      if (isCalendarOpenRef.current) return;
      // Don't close if clicking inside any Radix Popover/Dialog overlay
      const target = event.target as HTMLElement;
      if (
        target.closest('[data-radix-popper-content-wrapper]') ||
        target.closest('[data-radix-portal]') ||
        target.closest('[role="dialog"]') ||
        target.closest('.rdp') // react-day-picker calendar
      ) return;

      const clickedInsideDesktop = dropdownRef.current && dropdownRef.current.contains(event.target as Node);
      const clickedInsideMobile = mobileDropdownRef.current && mobileDropdownRef.current.contains(event.target as Node);
      if (!clickedInsideDesktop && !clickedInsideMobile) {
        setActiveDropdown(null);
        setDropdownPos(null);
      }
    };
    const handleWindowScroll = () => {
      if (isCalendarOpenRef.current) return;
      setActiveDropdown(null);
      setDropdownPos(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [worksRes, clientsRes, tasksRes, draftRes] = await Promise.all([
          api.works.getActive(),
          api.clients.getAll(),
          api.allocations.getMyTasks(),
          api.dailyReportDrafts.get(format(date, 'yyyy-MM-dd')).catch(() => ({ success: false, data: null }))
        ]);

        if (worksRes.success && worksRes.data) {
          // Merge API works with locally saved manual works
          const apiWorks = worksRes.data;
          const manualWorksKey = `manual_works_${user?.associationId || 'default'}`;
          const localManual: any[] = JSON.parse(localStorage.getItem(manualWorksKey) || '[]');
          // Only add local works that don't already exist in API works
          const merged = [...apiWorks];
          localManual.forEach(lw => {
            if (!merged.some(w => w.workTitle.toLowerCase() === lw.workTitle.toLowerCase())) {
              merged.push(lw);
            }
          });
          setAvailableWorks(merged);
        }

        const worksMap: Record<number, any> = {};
        if (worksRes.success && worksRes.data) {
          worksRes.data.forEach((w: any) => { worksMap[w.id] = w; });
        }
        if (clientsRes.success && clientsRes.data) setClients(clientsRes.data);

        const today = format(new Date(), 'yyyy-MM-dd');
        const isToday = format(date, 'yyyy-MM-dd') === today;

        // Only restore saved draft for TODAY if it was explicitly saved by user (submitted draft)
        // For past dates, always load from draft/localStorage
        if (!isToday) {
          // Past date — load from API draft
          if (draftRes.success && draftRes.data?.rowsJson) {
            try {
              const parsedRows = JSON.parse(draftRes.data.rowsJson);
              if (Array.isArray(parsedRows) && parsedRows.length > 0) {
                setRows(parsedRows);
                return;
              }
            } catch (e) { /* ignore */ }
          }
          // Fallback: localStorage for past dates
          const storageKey = `daily_report_${user?.id}_${format(date, 'yyyy-MM-dd')}`;
          const savedData = localStorage.getItem(storageKey);
          if (savedData) {
            try {
              const parsedRows = JSON.parse(savedData);
              if (Array.isArray(parsedRows) && parsedRows.length > 0) {
                setRows(parsedRows);
                return;
              }
            } catch (e) { /* ignore */ }
          }
          setRows(createEmptyRows(10));
          return;
        }

        // TODAY — always start fresh from live task data (ignore stale localStorage)

        // Auto-fill from allocations — ONLY in-progress tasks with today's or future due date
        // + tasks completed TODAY
        if (tasksRes.success && tasksRes.data) {
          const today = format(new Date(), 'yyyy-MM-dd');
          const tasksToFill = tasksRes.data.filter((task: any) => {
            // Only show in-progress tasks (active right now — no date restriction)
            if (task.status === 'in-progress' || task.status === 'in_progress') return true;
            // Only show tasks completed TODAY
            if (task.status === 'completed') {
              const completedDate = task.completedAt || task.CompletedAt;
              if (completedDate) {
                return format(new Date(completedDate), 'yyyy-MM-dd') === today;
              }
            }
            return false; // Skip pending and past completed tasks
          });
          if (tasksToFill.length > 0) {
            const newRows: WorkRow[] = tasksToFill.map((task: any) => {
              const matchedWork = worksMap[task.workId];
              const reportStatus: 'completed' | 'pending' | 'in-progress' =
                task.status === 'completed' ? 'completed' : 'in-progress';

              // If no matched work code, auto-save the task title as a work entry
              // and use it directly in the Work/Code column
              const taskTitle = task.workTitle || task.title || '';

              if (matchedWork) {
                // Has a proper work code — use it
                return {
                  id: `autofill-${task.id}-${Date.now()}`,
                  workCode: matchedWork.workCode,
                  workTitle: matchedWork.workTitle,
                  workDescription: task.description || '',
                  otherWorkTitle: '',
                  timeSpent: task.duration || '0h 0m',
                  clientId: task.clientId?.toString() || '',
                  status: reportStatus,
                  dueDate: format(new Date(), 'yyyy-MM-dd'),
                  adminDueDate: task.dueDate,
                  quantity: 0
                };
              } else if (taskTitle) {
                // No work code — find or create in availableWorks, show in Work/Code column
                const existingWork = availableWorks.find(
                  w => w.workTitle.toLowerCase() === taskTitle.toLowerCase()
                );
                if (existingWork) {
                  return {
                    id: `autofill-${task.id}-${Date.now()}`,
                    workCode: existingWork.workCode,
                    workTitle: existingWork.workTitle,
                    workDescription: task.description || '',
                    otherWorkTitle: '',
                    timeSpent: task.duration || '0h 0m',
                    clientId: task.clientId?.toString() || '',
                    status: reportStatus,
                    dueDate: format(new Date(), 'yyyy-MM-dd'),
                    adminDueDate: task.dueDate,
                    quantity: 0
                  };
                } else {
                  // Auto-create a work entry for this task title
                  const code = 'M-' + taskTitle.replace(/\s+/g, '').substring(0, 6).toUpperCase() + '-' + Date.now().toString().slice(-4);
                  const newWork = { id: Date.now(), workCode: code, workTitle: taskTitle, workType: 'Manual', isActive: true };
                  // Save to localStorage for persistence
                  const manualWorksKey = `manual_works_${user?.associationId || 'default'}`;
                  const localList = JSON.parse(localStorage.getItem(manualWorksKey) || '[]');
                  if (!localList.some((w: any) => w.workTitle.toLowerCase() === taskTitle.toLowerCase())) {
                    localList.push(newWork);
                    localStorage.setItem(manualWorksKey, JSON.stringify(localList));
                  }
                  // Add to dropdown
                  setAvailableWorks(prev => {
                    if (prev.some(w => w.workTitle.toLowerCase() === taskTitle.toLowerCase())) return prev;
                    return [...prev, newWork];
                  });
                  // Also try saving to API
                  api.works.create({ workCode: code, workTitle: taskTitle, workType: 'Manual' }).catch(() => {});
                  return {
                    id: `autofill-${task.id}-${Date.now()}`,
                    workCode: code,
                    workTitle: taskTitle,
                    workDescription: task.description || '',
                    otherWorkTitle: '',
                    timeSpent: task.duration || '0h 0m',
                    clientId: task.clientId?.toString() || '',
                    status: reportStatus,
                    dueDate: format(new Date(), 'yyyy-MM-dd'),
                    adminDueDate: task.dueDate,
                    quantity: 0
                  };
                }
              } else {
                // No title at all — empty row
                return {
                  id: `autofill-${task.id}-${Date.now()}`,
                  workCode: '',
                  workTitle: '',
                  workDescription: '',
                  otherWorkTitle: '',
                  timeSpent: task.duration || '0h 0m',
                  clientId: task.clientId?.toString() || '',
                  status: reportStatus,
                  dueDate: format(new Date(), 'yyyy-MM-dd'),
                  adminDueDate: task.dueDate,
                  quantity: 0
                };
              }
            });
            setRows(prev => {
              setAutoFilledRowIds(new Set(newRows.map(r => r.id)));
              const combined = [...newRows];
              if (combined.length < 10) combined.push(...createEmptyRows(10 - combined.length, combined.length));
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
    // Clear rows when date changes to avoid stale data flash
    return () => { setRows(createEmptyRows(10)); };
  }, [date, user?.id]);

  // Auto-save to API (debounced) + localStorage fallback
  useEffect(() => {
    if (isLoadingData) return;
    const storageKey = `daily_report_${user?.id}_${format(date, 'yyyy-MM-dd')}`;
    localStorage.setItem(storageKey, JSON.stringify(rows));
    const timer = setTimeout(() => {
      api.dailyReportDrafts.save(format(date, 'yyyy-MM-dd'), JSON.stringify(rows)).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [rows, date, user?.id, isLoadingData]);

  const handleManualSave = async (index: number) => {
    const row = rows[index];
    const storageKey = `daily_report_${user?.id}_${format(date, 'yyyy-MM-dd')}`;
    localStorage.setItem(storageKey, JSON.stringify(rows));
    api.dailyReportDrafts.save(format(date, 'yyyy-MM-dd'), JSON.stringify(rows)).catch(() => {});

    // If this row has a new client name, save it to the clients list
    if (row?.clientId === 'others' && row?.otherClientName?.trim()) {
      const clientName = row.otherClientName.trim();
      const alreadyExists = clients.some((c: any) => c.name?.toLowerCase() === clientName.toLowerCase());
      if (!alreadyExists) {
        try {
          const res = await api.clients.create({
            name: clientName, company: clientName,
            email: `${clientName.toLowerCase().replace(/\s+/g, '.')}@client.com`,
            isActive: true
          });
          if (res.success && res.data) {
            setClients((prev: any[]) => [...prev, res.data]);
            handleRowUpdate(row.id, { clientId: res.data.id.toString(), otherClientName: '' });
            toast.success(`Client "${clientName}" saved and selected ✓`);
            return;
          }
        } catch { /* keep as manual */ }
      } else {
        // Already exists — find and select it
        const existing = clients.find((c: any) => c.name?.toLowerCase() === clientName.toLowerCase());
        if (existing) handleRowUpdate(row.id, { clientId: existing.id.toString(), otherClientName: '' });
      }
    }

    // If this row has a manual work title, save it to the dropdown and select it
    if (row?.workCode === 'OTHERS' && row?.otherWorkTitle?.trim()) {
      const title = row.otherWorkTitle.trim();

      // Check if already exists in dropdown
      const existing = availableWorks.find(
        w => w.workTitle.toLowerCase() === title.toLowerCase()
      );

      if (existing) {
        // Already exists — just select it in this row
        handleRowUpdate(row.id, {
          workCode: existing.workCode,
          workTitle: existing.workTitle,
          otherWorkTitle: '',
        });
        toast.success(`"${title}" selected`);
        return;
      }

      // Generate a unique code
      const code = 'M-' + title.replace(/\s+/g, '').substring(0, 6).toUpperCase() + '-' + Date.now().toString().slice(-4);
      const newWork = { id: Date.now(), workCode: code, workTitle: title, workType: 'Manual', isActive: true };

      // 1. Try saving to backend API
      let savedWork = newWork;
      try {
        const res = await api.works.create({ workCode: code, workTitle: title, workType: 'Manual' });
        if (res.success && res.data) {
          savedWork = res.data;
        }
      } catch { /* fallback to local */ }

      // 2. Save to localStorage
      const manualWorksKey = `manual_works_${user?.associationId || 'default'}`;
      const localList = JSON.parse(localStorage.getItem(manualWorksKey) || '[]');
      localList.push(savedWork);
      localStorage.setItem(manualWorksKey, JSON.stringify(localList));

      // 3. Add to dropdown
      setAvailableWorks(prev => [...prev, savedWork]);

      // 4. Auto-select the saved work in this row — switch from OTHERS to the new work code
      handleRowUpdate(row.id, {
        workCode: savedWork.workCode,
        workTitle: savedWork.workTitle,
        otherWorkTitle: '',
      });

      toast.success(`"${title}" saved and selected ✓`);
    } else {
      toast.success(`Row ${index + 1} saved`);
    }
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
          ? { ...row, workCode: work.workCode, workTitle: work.workTitle, workDescription: '' }
          : row
      )
    );
    setActiveDropdown(null);
    setDropdownPos(null);
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
    if (!canCreate) { toast.error("You don't have permission to submit reports"); return; }
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

  useEffect(() => {
    if (activeDropdown) {
      document.body.style.overflow = 'hidden';
      // To prevent layout shift
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [activeDropdown]);

  const filledRowsCount = rows.filter((row) => row.workDescription.trim()).length;
  const hasOthersWork = rows.some(r => r.workCode === 'OTHERS');
  const hasOthersClient = rows.some(r => r.clientId === 'others');

  return (
    <DashboardLayout>
      <div className="w-full">
        {/* ===== DESKTOP HEADER (Hidden on Mobile) ===== */}
        <div className="hidden lg:flex items-center justify-between gap-3 mb-8 animate-in fade-in duration-500 bg-primary p-8 rounded-3xl text-white shadow-xl shadow-primary/20"
          style={{ background: `linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.85) 100%)` }}>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Daily Report</h1>
            <p className="text-white/80 font-medium">Log your daily activities and time spent</p>
          </div>
          <div className="flex items-center gap-3">
            <Popover open={isCalendarOpen} onOpenChange={handleCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-11 gap-2 px-5 bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl shadow-sm backdrop-blur-md">
                  <CalendarIcon className="h-4 w-4 text-white" />
                  <span className="font-bold uppercase tracking-wider text-xs">{format(date, 'MMMM dd, yyyy')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={date}
                  onSelect={(newDate) => {
                    if (newDate) {
                      setDate(newDate);
                      // Close after a tick so the selection registers visually
                      setTimeout(() => handleCalendarOpen(false), 50);
                    }
                  }}
                  initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button onClick={handleSubmit} disabled={isSubmitting || filledRowsCount === 0}
              size="sm" className="h-11 gap-2 px-8 bg-white text-sky-600 hover:bg-white/90 font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest text-xs">
              {isSubmitting ? <span className="animate-spin text-lg">⏳</span> : <Save className="h-4 w-4" />}
              Submit Report
            </Button>
          </div>
        </div>

        {/* ===== MOBILE HEADER (Curved Style) ===== */}
        <div className="lg:hidden -mx-3 -mt-4 mb-8">
          <div className="bg-primary/95 pt-10 pb-16 px-6 rounded-b-[2.5rem] shadow-lg text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Daily log</h1>
                <p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Staff Portal · {format(date, 'MMM dd')}</p>
              </div>
              <Popover open={isCalendarOpen} onOpenChange={handleCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="bg-white/10 hover:bg-white/20 text-white rounded-2xl h-11 px-4 gap-2 border-none backdrop-blur-md active:scale-95 transition-transform">
                    <CalendarIcon className="h-5 w-5" />
                    <span className="font-black text-xs uppercase tracking-wider">{format(date, 'MMM dd')}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="end">
                  <Calendar mode="single" selected={date}
                    onSelect={(newDate) => {
                      if (newDate) {
                        setDate(newDate);
                        setTimeout(() => handleCalendarOpen(false), 50);
                      }
                    }}
                    initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex-1 mr-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Filing Progress</span>
                  <span className="text-[10px] font-black text-white/90">{filledRowsCount}/10 rows</span>
                </div>
                <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-700 ease-out" 
                    style={{ width: `${Math.min((filledRowsCount/10)*100, 100)}%` }} 
                  />
                </div>
              </div>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || filledRowsCount === 0}
                className="bg-white text-primary hover:bg-slate-100 rounded-2xl h-12 px-5 font-black text-xs uppercase tracking-wider shadow-xl active:scale-95 transition-all"
              >
                {isSubmitting ? "Wait..." : "Submit"}
              </Button>
            </div>
          </div>

          {/* Stats Summary Row */}
          <div className="px-5 -mt-7 relative z-20 flex gap-3">
             <div className="flex-1 bg-white dark:bg-card rounded-3xl p-4 shadow-lg ring-1 ring-black/5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 leading-none">{filledRowsCount}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Filled</p>
                </div>
             </div>
             <div className="flex-1 bg-white dark:bg-card rounded-3xl p-4 shadow-lg ring-1 ring-black/5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 leading-none">10+</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Goal</p>
                </div>
             </div>
          </div>
        </div>

        {/* Global Save Indicator Area — hidden lg */}
        <div className="hidden lg:flex items-center justify-between px-1 mb-4">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{filledRowsCount}</span> entr{filledRowsCount === 1 ? 'y' : 'ies'} filled
          </span>
          {autoFilledRowIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAutoFilledRows} className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" /> Clear auto-filled ({autoFilledRowIds.size})
            </Button>
          )}
        </div>

        <Card className="border shadow-xl overflow-hidden rounded-[2rem] lg:rounded-xl">
          <CardHeader className="bg-muted/30 lg:bg-muted/50 pb-4 border-b hidden lg:block">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-xl flex items-center gap-2 font-bold">
                <FileText className="h-5 w-5 text-primary" />
                Work Entries
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop View (Table) */}
            <div className="hidden lg:block relative scrollbar-thin-primary" ref={tableContainerRef} style={{ maxHeight: '520px', overflowY: 'auto', overflowX: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--primary) / 0.3) transparent' }}>
              <Table className="table-fixed" style={{ minWidth: '1400px', width: '1400px' }}>
                <TableHeader className="bg-muted/20 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-10 text-muted-foreground text-center">#</TableHead>
                    <TableHead className="w-56">Work / Code</TableHead>
                    {hasOthersWork && <TableHead className="w-48 animate-in slide-in-from-left-2 duration-300">Manual Work</TableHead>}
                    <TableHead className="w-72">Description</TableHead>
                    <TableHead className="w-28 text-center">Count</TableHead>
                    <TableHead className="w-36 text-center">Time Spent</TableHead>
                    <TableHead className="w-48">Client</TableHead>
                    {hasOthersClient && <TableHead className="w-44 animate-in slide-in-from-left-2 duration-300">New Client Name</TableHead>}
                    <TableHead className="w-28 text-center">Status</TableHead>
                    <TableHead className="w-40">Due Date</TableHead>
                    <TableHead className="w-24 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-medium align-top py-4">{index + 1}</TableCell>
                      <TableCell className="align-top py-4">
                        <div className="relative" ref={activeDropdown === `work-${row.id}` ? dropdownRef : null}>
                          <div className="flex gap-1.5 h-10">
                            <Button
                              variant={row.workCode === 'OTHERS' ? 'default' : 'outline'}
                              size="icon"
                              className={cn("h-10 w-10 shrink-0", row.workCode === 'OTHERS' ? "bg-primary shadow-md" : "border-slate-200")}
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
                                "flex-1 border rounded-md px-3 py-2 text-sm bg-background/50 hover:bg-background cursor-pointer transition-all flex items-center justify-between truncate",
                                row.workCode ? "border-primary/40 ring-1 ring-primary/20" : "border-slate-200",
                                row.workCode === 'OTHERS' && "opacity-50 pointer-events-none"
                              )}
                              onClick={(e) => {
                                if (activeDropdown === `work-${row.id}`) {
                                  setActiveDropdown(null);
                                  setDropdownPos(null);
                                } else {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setDropdownPos({ 
                                    top: rect.bottom + 4, 
                                    left: rect.left, 
                                    width: Math.max(rect.width, 340) 
                                  });
                                  setActiveDropdown(`work-${row.id}`);
                                  setSearchTerm('');
                                }
                              }}
                            >
                              <span className="truncate font-medium">
                                {row.workCode === 'OTHERS' ? "Custom Work" : (row.workCode ? `[${row.workCode}] ${row.workTitle || ''}` : "Select Work")}
                              </span>
                              <Search className="h-4 w-4 opacity-30 ml-2" />
                            </div>
                          </div>

                          {activeDropdown === `work-${row.id}` && dropdownPos && (
                            <div
                              ref={dropdownRef}
                              className="fixed z-[9999] rounded-xl border bg-popover p-2 text-popover-foreground shadow-[0_10px_40px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200"
                              style={{ 
                                top: dropdownPos.top, 
                                left: dropdownPos.left, 
                                width: dropdownPos.width, 
                                minWidth: 340,
                                maxHeight: Math.min(320, window.innerHeight - dropdownPos.top - 16),
                                display: 'flex',
                                flexDirection: 'column'
                              }}
                            >
                              <div className="flex items-center border-b px-2 pb-2 mb-2">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-primary" />
                                <input
                                  className="flex h-10 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground font-medium"
                                  placeholder="Search work or code..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  autoFocus
                                />
                              </div>
                              <div className="flex-1 overflow-y-auto scrollbar-hide px-1" style={{ maxHeight: 'calc(100% - 60px)' }}>
                                {filteredWorks.map((work) => (
                                  <div
                                    key={work.id}
                                    className="relative flex cursor-default select-none items-center rounded-lg px-2.5 py-3 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-all mb-1 last:mb-0"
                                    onClick={() => handleSelectWork(row.id, work)}
                                  >
                                    <span className="font-bold text-primary mr-3 bg-primary/5 px-2 py-0.5 rounded text-[11px] min-w-[65px] text-center shrink-0">[{work.workCode}]</span>
                                    <span className="font-semibold truncate">{work.workTitle}</span>
                                  </div>
                                ))}
                                {filteredWorks.length === 0 && (
                                  <div className="py-8 text-center text-sm text-muted-foreground italic">No work matching "{searchTerm}" found.</div>
                                )}
                                <div className="border-t mt-2 pt-2">
                                  <div
                                    className="relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-3 text-sm font-bold text-primary hover:bg-primary/5 transition-colors"
                                    onClick={() => { handleRowUpdate(row.id, { workCode: 'OTHERS', workDescription: '' }); setActiveDropdown(null); setDropdownPos(null); }}
                                  >
                                    <Plus className="h-4 w-4 mr-2" /> Others (Manual Entry)
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {hasOthersWork && (
                        <TableCell className="align-top py-4 w-44 animate-in slide-in-from-left-2 duration-300">
                          <div className="flex items-center gap-1.5">
                            <Input
                              placeholder="e.g. Site Inspection..."
                              className="h-10 text-xs border-primary/30 bg-white font-bold text-primary shadow-sm flex-1"
                              value={row.otherWorkTitle || ''}
                              onChange={(e) => handleRowUpdate(row.id, { otherWorkTitle: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && row.otherWorkTitle?.trim()) {
                                  handleManualSave(index);
                                }
                              }}
                            />
                            {row.otherWorkTitle?.trim() && (
                              <button
                                type="button"
                                title="Save work title (Enter)"
                                onClick={() => handleManualSave(index)}
                                className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="align-top py-4 min-w-[300px]">
                        <textarea
                          placeholder="What did you work on?..."
                          className="description-textarea focus:ring-1 focus:ring-primary/20 transition-all font-medium py-2"
                          value={row.workDescription}
                          onChange={(e) => {
                            handleDescriptionChange(row.id, e.target.value);
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
                      <TableCell className="align-top py-4 w-24">
                        <Input
                          type="number"
                          min="0"
                          className="h-10 w-full text-center font-black text-black border-2 border-primary/30 bg-white shadow-sm placeholder:text-slate-200 focus-visible:ring-primary px-2"
                          value={row.quantity || ''}
                          onChange={(e) => handleRowUpdate(row.id, { quantity: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="align-top py-4 w-36">
                        <div className="flex items-center gap-1.5 h-10">
                          <select
                            value={getTimeParts(row.timeSpent).h}
                            onChange={(e) => handleTimeUpdate(row.id, 'h', e.target.value)}
                            className="bg-white border-2 border-slate-200 hover:border-primary/20 rounded-md px-1 h-10 text-xs w-full font-black text-slate-900 appearance-none cursor-pointer shadow-sm transition-colors text-center"
                          >
                            {Array.from({ length: 13 }, (_, i) => (<option key={i} value={i}>{i}h</option>))}
                          </select>
                          <select
                            value={getTimeParts(row.timeSpent).m}
                            onChange={(e) => handleTimeUpdate(row.id, 'm', e.target.value)}
                            className="bg-white border-2 border-slate-200 hover:border-primary/20 rounded-md px-1 h-10 text-xs w-full font-black text-slate-900 appearance-none cursor-pointer shadow-sm transition-colors text-center"
                          >
                            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (<option key={m} value={m}>{m}m</option>))}
                          </select>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-4 w-40">
                        <div className="flex gap-1.5 h-10">
                          <Button
                            variant={row.clientId === 'others' ? 'default' : 'outline'}
                            size="icon"
                            className={cn("h-10 w-10 shrink-0", row.clientId === 'others' ? "bg-primary shadow-md" : "border-slate-200")}
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
                            <SelectTrigger className="h-10 border-slate-200 hover:border-primary/20 overflow-hidden font-medium text-xs flex-1">
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl overflow-hidden shadow-2xl border-none">
                              {clients.map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()} className="font-semibold">{c.name}</SelectItem>
                              ))}
                              <SelectItem value="others" className="font-black text-primary bg-primary/5">Others (Manual) +</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      {hasOthersClient && (
                        <TableCell className="align-top py-4 w-44 animate-in slide-in-from-left-2 duration-300">
                          {row.clientId === 'others' ? (
                            <Input
                              placeholder="Type client name..."
                              className="h-10 text-xs border-primary/30 bg-white font-bold text-primary shadow-sm"
                              value={row.otherClientName || ''}
                              onChange={(e) => handleRowUpdate(row.id, { otherClientName: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter' && row.otherClientName?.trim()) handleManualSave(index); }}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="align-top py-4 w-24">
                        <Select value={row.status} onValueChange={(val: 'completed' | 'pending' | 'in-progress') => handleRowUpdate(row.id, { status: val })}>
                          <SelectTrigger className={cn("h-10 text-[10px] font-black uppercase tracking-widest border-slate-200",
                            row.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            row.status === 'in-progress' ? "bg-blue-50 text-blue-600 border-blue-100" :
                            "bg-amber-50 text-amber-600 border-amber-100"
                          )}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl overflow-hidden shadow-xl border-none">
                            <SelectItem value="completed" className="text-emerald-600 font-bold">DONE</SelectItem>
                            <SelectItem value="in-progress" className="text-blue-600 font-bold">IN PROGRESS</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top py-4 w-40">
                        <Input
                          type="date"
                          className="h-10 text-xs font-bold border-slate-200 w-full"
                          value={row.dueDate}
                          onChange={(e) => handleRowUpdate(row.id, { dueDate: e.target.value })}
                          min={format(new Date(), 'yyyy-MM-dd')}
                        />
                      </TableCell>
                      <TableCell className="text-center align-top py-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleManualSave(index)}
                            className="text-primary hover:text-white hover:bg-primary h-9 w-9 rounded-xl transition-all"
                            title="Save Row"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(row.id)}
                            className="text-muted-foreground hover:text-white hover:bg-destructive h-9 w-9 rounded-xl transition-all"
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

            {/* Mobile View (Premium Cards) */}
            <div className="lg:hidden bg-slate-50/50 dark:bg-slate-950/50 p-3 space-y-5 pb-24 overflow-visible">
              {rows.map((row, index) => (
                <div 
                  key={row.id} 
                  className={cn(
                    "bg-white dark:bg-card rounded-[1.5rem] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.04)] ring-1 transition-all",
                    row.workDescription.trim() || row.workCode ? "ring-primary/20 shadow-primary/5" : "ring-black/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase tracking-widest">Row {index + 1}</span>
                      {row.workCode === 'OTHERS' && <Badge variant="outline" className="text-[7px] bg-amber-50 text-amber-600 border-amber-200 font-black px-1.5 py-0 h-4">CUSTOM</Badge>}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManualSave(index)}
                        className="h-8 w-8 rounded-lg text-primary hover:bg-primary/5 active:scale-90 transition-transform"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeRow(row.id)} 
                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/5 active:scale-90 transition-transform"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Work Selector Mobile */}
                  <div className="space-y-1.5 mb-4 px-0.5">
                    <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest ml-1">Work / Activity</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={row.workCode === 'OTHERS' ? 'default' : 'outline'}
                        size="icon"
                        className={cn(
                          "h-10 w-10 rounded-xl shrink-0 transition-all border-slate-200", 
                          row.workCode === 'OTHERS' ? "bg-primary shadow-md border-none" : "hover:border-primary/30"
                        )}
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
                      <div className="relative flex-1 h-10 min-w-0" ref={activeDropdown === `work-${row.id}` ? mobileDropdownRef : null}>
                        <button
                          className={cn(
                            "w-full h-10 border-none rounded-xl px-3.5 py-2 text-[13px] bg-slate-50 dark:bg-slate-900 flex items-center justify-between font-bold ring-1 transition-all text-left min-w-0",
                            row.workCode ? "ring-primary/20 bg-primary/5 text-primary" : "ring-slate-100 text-slate-500",
                            row.workCode === 'OTHERS' && "opacity-50 pointer-events-none grayscale"
                          )}
                          onClick={() => {
                            setActiveDropdown(activeDropdown === `work-${row.id}` ? null : `work-${row.id}`);
                            setSearchTerm('');
                          }}
                        >
                          <span className="truncate block flex-1 mr-1">{row.workCode === 'OTHERS' ? "Custom Entry" : (row.workCode ? `[${row.workCode}] ${row.workTitle || ''}` : "Select Work...")}</span>
                          <Search className="h-3.5 w-3.5 opacity-30 shrink-0" />
                        </button>
                        {activeDropdown === `work-${row.id}` && (
                          <div className="fixed inset-x-2 top-[12%] bottom-[12%] z-[200] rounded-[2rem] border bg-card/95 backdrop-blur-3xl shadow-[0_40px_120px_rgba(0,0,0,0.3)] flex flex-col animate-in fade-in zoom-in-95 duration-300 ring-1 ring-black/5">
                            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
                               <h3 className="text-xs font-black uppercase tracking-widest text-primary">Service Catalog</h3>
                               <Button variant="ghost" size="sm" onClick={() => setActiveDropdown(null)} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200">✕</Button>
                            </div>
                            <div className="p-3 shrink-0">
                              <div className="flex items-center bg-slate-50 rounded-xl px-3 py-0.5 ring-1 ring-slate-100 focus-within:ring-primary/30 transition-all">
                                <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-40 text-primary" />
                                <input
                                  className="flex h-10 w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-slate-400 font-bold"
                                  placeholder="Type code or title..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5 scrollbar-hide">
                              {filteredWorks.map((work) => (
                                <div key={work.id} className="p-3 bg-slate-50/50 hover:bg-primary/10 rounded-2xl text-[13px] active:scale-[0.98] transition-all flex items-center gap-3 border border-transparent hover:border-primary/10 group" onClick={() => handleSelectWork(row.id, work)}>
                                  <span className="font-black text-[9px] bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-100 text-primary shrink-0">[{work.workCode}]</span> 
                                  <span className="font-bold text-slate-700 leading-snug truncate">{work.workTitle}</span>
                                </div>
                              ))}
                              {filteredWorks.length === 0 && (
                                <div className="py-12 text-center text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] opacity-40 italic">Nothing found</div>
                              )}
                              <div className="p-3 text-primary font-black border-t mt-3 flex items-center gap-3 hover:bg-primary/5 rounded-2xl transition-all cursor-pointer" onClick={() => { handleRowUpdate(row.id, { workCode: 'OTHERS', workDescription: '' }); setActiveDropdown(null); }}>
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Plus className="h-4 w-4" /></div>
                                <span className="text-[11px]">Define custom title</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {row.workCode === 'OTHERS' && (
                      <div className="mt-2.5 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Type custom work name..."
                            className="text-xs border-none bg-amber-50/50 dark:bg-amber-900/10 placeholder:text-amber-300 font-bold text-amber-700 h-10 rounded-xl ring-1 ring-amber-100 px-3.5 focus-visible:ring-amber-200 flex-1"
                            value={row.otherWorkTitle || ''}
                            onChange={(e) => handleRowUpdate(row.id, { otherWorkTitle: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && row.otherWorkTitle?.trim()) {
                                handleManualSave(index);
                              }
                            }}
                          />
                          {row.otherWorkTitle?.trim() && (
                            <button
                              type="button"
                              title="Save"
                              onClick={() => handleManualSave(index)}
                              className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-primary text-white active:scale-95 transition-all shadow-sm"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description Mobile */}
                  <div className="space-y-1.5 mb-4 px-0.5">
                    <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest ml-1">Description</Label>
                    <textarea
                      placeholder="Specify your tasks..."
                      className="flex min-h-[80px] w-full rounded-xl border-none bg-slate-50 dark:bg-slate-900 px-3.5 py-3 text-[13px] font-semibold ring-1 ring-slate-100 placeholder:text-slate-400 focus-visible:ring-primary/20 transition-all resize-none leading-relaxed"
                      value={row.workDescription}
                      onChange={(e) => handleDescriptionChange(row.id, e.target.value)}
                    />
                  </div>

                  {/* Grid Layout for compact fields */}
                  <div className="grid grid-cols-5 gap-4 mb-4 px-0.5">
                    <div className="col-span-2 space-y-1.5">
                       <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest ml-1">Quantity</Label>
                       <Input
                          type="number"
                          className="h-10 rounded-xl border-none bg-slate-50 font-black text-center text-base ring-1 ring-slate-100 focus-visible:ring-primary/30 shadow-inner p-0"
                          value={row.quantity || ''}
                          onChange={(e) => handleRowUpdate(row.id, { quantity: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                        />
                    </div>
                    <div className="col-span-3 space-y-1.5">
                       <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest ml-1">Time Spent</Label>
                       <div className="flex gap-2 h-10">
                          <select
                            value={getTimeParts(row.timeSpent).h}
                            onChange={(e) => handleTimeUpdate(row.id, 'h', e.target.value)}
                            className="flex-1 bg-slate-50 border-none ring-1 ring-slate-100 rounded-xl h-full text-[13px] font-black text-slate-800 text-center appearance-none shadow-sm focus:ring-primary/20 outline-none"
                          >
                            {Array.from({ length: 13 }, (_, i) => (<option key={i} value={i}>{i}h</option>))}
                          </select>
                          <select
                            value={getTimeParts(row.timeSpent).m}
                            onChange={(e) => handleTimeUpdate(row.id, 'm', e.target.value)}
                            className="flex-1 bg-slate-50 border-none ring-1 ring-slate-100 rounded-xl h-full text-[13px] font-black text-slate-800 text-center appearance-none shadow-sm focus:ring-primary/20 outline-none"
                          >
                            {[0, 15, 30, 45].map((m) => (<option key={m} value={m}>{m}m</option>))}
                          </select>
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5 px-0.5">
                    <div className="space-y-1.5 min-w-0">
                       <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest ml-1">Client</Label>
                       <div className="flex items-center gap-1.5 min-w-0">
                          <Button
                            variant={row.clientId === 'others' ? 'default' : 'outline'}
                            size="icon"
                            className={cn(
                              "h-10 w-10 min-w-[40px] rounded-xl shrink-0 border-slate-200 active:scale-90 transition-all", 
                              row.clientId === 'others' ? "bg-primary border-none shadow-md" : "hover:border-primary/30"
                            )}
                            onClick={() => {
                              if (row.clientId === 'others') handleRowUpdate(row.id, { clientId: '', otherClientName: '' });
                              else handleRowUpdate(row.id, { clientId: 'others' });
                            }}
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Select
                            value={row.clientId}
                            onValueChange={(val) => handleRowUpdate(row.id, { clientId: val })}
                            disabled={row.clientId === 'others'}
                          >
                            <SelectTrigger className="h-10 border-none ring-1 ring-slate-100 bg-slate-50 rounded-xl font-bold text-[11px] px-2 focus:ring-primary/20 min-w-0 overflow-hidden">
                              <SelectValue placeholder="Client..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl p-1.5 z-[250]">
                              {clients.map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()} className="rounded-xl font-bold text-xs">{c.name}</SelectItem>
                              ))}
                              <SelectItem value="others" className="font-black text-primary bg-primary/5 rounded-xl text-xs mt-1">Other +</SelectItem>
                            </SelectContent>
                          </Select>
                       </div>
                    </div>
                    <div className="space-y-1.5 min-w-0">
                       <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest ml-1">Status</Label>
                       <Select value={row.status} onValueChange={(val: 'completed' | 'pending') => handleRowUpdate(row.id, { status: val })}>
                          <SelectTrigger className={cn(
                            "h-10 rounded-xl border-none ring-1 font-black text-[11px] uppercase tracking-wider px-2 shadow-none focus:ring-offset-0 min-w-0 overflow-hidden",
                            row.status === 'completed' ? "ring-emerald-100 bg-emerald-50/50 text-emerald-600" :
                            row.status === 'in-progress' ? "ring-blue-100 bg-blue-50/50 text-blue-600" :
                            "ring-amber-100 bg-amber-50/50 text-amber-600"
                          )}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none shadow-2xl z-[250]">
                            <SelectItem value="completed" className="font-black text-emerald-600 text-xs">DONE</SelectItem>
                            <SelectItem value="in-progress" className="font-black text-blue-600 text-xs">IN PROGRESS</SelectItem>
                          </SelectContent>
                        </Select>
                    </div>
                  </div>

                  {/* New Client Mobile */}
                  {row.clientId === 'others' && (
                    <div className="mt-3 px-1 animate-in slide-in-from-top-2 duration-300">
                      <Input
                        placeholder="Enter client name..."
                        className="h-10 border-none bg-primary/5 placeholder:text-primary/30 font-bold text-primary rounded-xl ring-1 ring-primary/10 px-3.5 text-xs"
                        value={row.otherClientName || ''}
                        onChange={(e) => handleRowUpdate(row.id, { otherClientName: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Due Date Mobile */}
                  {row.status === 'pending' && (
                    <div className="mt-3 px-1 animate-in slide-in-from-top-2 duration-300">
                      <Label className="text-[9px] uppercase font-black text-amber-600 tracking-widest mb-1.5 block ml-1">Scheduled Date</Label>
                      <Input
                        type="date"
                        className="h-10 border-none bg-amber-50/50 font-bold text-amber-700 rounded-xl ring-1 ring-amber-100 px-3.5 text-xs"
                        value={row.dueDate}
                        onChange={(e) => handleRowUpdate(row.id, { dueDate: e.target.value })}
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                  )}
                </div>
              ))}

              <div className="pt-2 pb-16">
                <Button 
                  onClick={addRow} 
                  variant="outline" 
                  className="w-full h-14 rounded-[1.5rem] border-dashed border-2 border-slate-200 text-slate-400 font-black uppercase tracking-[0.15em] text-[10px] gap-2.5 hover:bg-white hover:text-primary hover:border-primary/30 transition-all active:scale-[0.98] shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Additional Entry
                </Button>
              </div>
            </div>

            {/* Desktop Footer (Add Rows) */}
            <div className="hidden lg:block p-8 bg-muted/10 border-t">
              <Button
                variant="outline"
                className="w-full border-dashed border-2 py-10 transition-all hover:bg-muted/30 group h-auto rounded-xl"
                onClick={addRow}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-base">Add New Entry Row</p>
                    <p className="text-xs text-muted-foreground font-medium">Click here to add another line to your daily report</p>
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DailyReport;