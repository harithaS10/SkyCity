import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  MessageSquare, 
  MapPin, 
  Wrench,
  CheckCircle2,
  Clock,
  Send
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const ComplaintDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isResident, isStaff, isHelpdesk } = useAuth();
  const queryClient = useQueryClient();
  const [resolutionNote, setResolutionNote] = useState('');

  const { data: response, isLoading } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => api.complaints.getById(Number(id))
  });
  
  const complaint = response?.data;

  const resolveMutation = useMutation({
    mutationFn: (notes: string) => 
      api.complaints.resolve(Number(id), { resolution: 'Completed by Staff', notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      toast.success('Complaint resolved successfully');
      setResolutionNote('');
    }
  });

  if (isLoading) return <div className="p-10 text-center">Loading complaint details...</div>;
  if (!complaint) return <div className="p-10 text-center">Complaint not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-in fade-in duration-500">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{complaint.complaintNumber}</h1>
            <Badge variant="outline" className={`
              ${complaint.status === 'Resolved' ? 'bg-green-50 text-green-700' : 
                complaint.status === 'Open' ? 'bg-blue-50 text-blue-700' : 
                'bg-amber-50 text-amber-700'}
            `}>
              {complaint.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-lg">{complaint.title || 'General Maintenance'}</p>
        </div>
        <div className="flex gap-2">
          {isHelpdesk && complaint.status === 'Open' && (
            <Button className="bg-primary">Assign Staff</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm border-none ring-1 ring-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-700 leading-relaxed">
              {complaint.description || 'No detailed description provided.'}
            </p>
            <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin size={16} />
                <span>Unit {complaint.unit?.unitNumber}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar size={16} />
                <span>Reported: {new Date(complaint.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none ring-1 ring-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Resident Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <User size={20} className="text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">{complaint.resident?.fullName || 'Harikrishnan'}</p>
                <p className="text-xs text-muted-foreground">{complaint.resident?.phone || '+91 9876543210'}</p>
              </div>
            </div>
            <div className="pt-4 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Priority</p>
              <Badge className={
                complaint.priority === 'High' ? 'bg-red-500' : 
                complaint.priority === 'Medium' ? 'bg-amber-500' : 'bg-slate-500'
              }>
                {complaint.priority}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {isStaff && complaint.status === 'Assigned' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench size={18} /> Resolution Detail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea 
              placeholder="Describe the resolution steps taken..." 
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="min-h-[120px] bg-white"
            />
            <Button 
              className="w-full"
              disabled={!resolutionNote || resolveMutation.isPending}
              onClick={() => resolveMutation.mutate(resolutionNote)}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Resolved
            </Button>
          </CardContent>
        </Card>
      )}

      {complaint.status === 'Resolved' && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="text-lg text-green-800 flex items-center gap-2">
              <CheckCircle2 size={18} /> Resolution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm italic text-green-900 mb-4">"{complaint.resolutionNotes || 'Successfully resolved.'}"</p>
            <p className="text-xs text-green-700">Resolved at: {new Date(complaint.resolvedAt).toLocaleString()}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComplaintDetail;
