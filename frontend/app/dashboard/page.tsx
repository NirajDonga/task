'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAtom } from 'jotai'; 
import { io } from 'socket.io-client'; 
import api from '@/lib/api';
import { jobsAtom, uploadingAtom } from '../../store/atoms'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useAtom(jobsAtom);
  const [uploading, setUploading] = useAtom(uploadingAtom);

  const fetchJobs = async () => {
    try {
      const { data } = await api.get('/jobs');
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchJobs();

    const socket = io('http://localhost:3001');

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
    });

    socket.on('job-completed', (data: any) => {
      console.log('Job Completed:', data);
      setJobs((prev) => prev.map(job => 
        job._id === data.jobId 
          ? { ...job, status: 'completed', thumbnailUrl: data.thumbnailUrl } 
          : job
      ));
    });

    socket.on('job-failed', (data: any) => {
      setJobs((prev) => prev.map(job => 
        job._id === data.jobId ? { ...job, status: 'failed' } : job
      ));
    });

    return () => {
      socket.disconnect();
    };
  }, [router, setJobs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const newJob = { 
        _id: data.jobId, 
        originalName: e.target.files[0].name, 
        status: 'queued',
        createdAt: new Date().toISOString()
      } as any;
      
      setJobs(prev => [newJob, ...prev]);
    } catch (err) {
      alert('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = ''; 
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'processing': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Thumbnail Generator</h1>
        <Button variant="outline" onClick={() => {
          localStorage.removeItem('token');
          router.push('/login');
        }}>Logout</Button>
      </div>

      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <Input type="file" onChange={handleUpload} disabled={uploading} />
            <Button disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Video/Image'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map((job) => (
          <Card key={job._id} className="overflow-hidden">
            <div className="h-40 bg-gray-100 flex items-center justify-center relative">
              {job.status === 'completed' ? (
                <img 
                  src={`http://localhost:3001${job.thumbnailUrl}`} 
                  alt="Thumbnail" 
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/file.svg' }}
                />
              ) : (
                <span className="text-gray-400 capitalize animate-pulse">{job.status}</span>
              )}
            </div>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium truncate pr-2" title={job.originalName}>{job.originalName}</p>
                <Badge variant={getStatusColor(job.status) as any}>{job.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}