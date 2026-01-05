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

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? apiBaseUrl;

export default function Dashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useAtom(jobsAtom);
  const [uploading, setUploading] = useAtom(uploadingAtom);

  const fetchJobs = async () => {
    try {
      const { data } = await api.get('/jobs');
      // Filter to show only thumbnail jobs or jobs with no type
      setJobs(data.filter((j: any) => j.type === 'thumbnail' || !j.type)); 
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

    const socket = io(socketUrl);

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
    if (!e.target.files?.length) return; 
    
    setUploading(true);
    const formData = new FormData();
    
    Array.from(e.target.files).forEach((file) => {
      formData.append('files', file); 
    });

    try {
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const newJobs = data.jobs.map((job: any) => ({
        _id: job.jobId, 
        originalName: job.originalName, 
        status: 'queued',
        type: 'thumbnail', 
        createdAt: new Date().toISOString()
      }));
      
      setJobs(prev => [...newJobs, ...prev]);
    } catch (err) {
      console.error(err);
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

  const downloadThumbnail = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename; 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Thumbnail Generator</h1>
        
        {/* Navigation Buttons */}
        <div className="flex gap-3">
            <Button onClick={() => router.push('/converter')} variant="secondary">
                Go to Converter
            </Button>
            <Button variant="outline" onClick={() => {
            localStorage.removeItem('token');
            router.push('/login');
            }}>Logout</Button>
        </div>
      </div>

      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <Input type="file" onChange={handleUpload} disabled={uploading} multiple />
            <Button disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Video/Image'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map((job) => {
          const thumbnailUrl = `${apiBaseUrl}${job.thumbnailUrl}`;
          
          return (
            <Card key={job._id} className="overflow-hidden flex flex-col">
              <div className="h-40 bg-gray-100 flex items-center justify-center relative">
                {job.status === 'completed' ? (
                  <img 
                    src={thumbnailUrl} 
                    alt="Thumbnail" 
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/file.svg' }}
                  />
                ) : (
                  <span className="text-gray-400 capitalize animate-pulse">{job.status}</span>
                )}
              </div>
              
              <CardContent className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-4">
                  <p className="font-medium truncate pr-2 flex-1" title={job.originalName}>
                    {job.originalName}
                  </p>
                  <Badge variant={getStatusColor(job.status) as any}>{job.status}</Badge>
                </div>

                {job.status === 'completed' && (
                  <div className="flex gap-2 mt-auto pt-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <a href={thumbnailUrl} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                    <Button size="sm" className="flex-1" asChild 
                    onClick={() => downloadThumbnail(thumbnailUrl, `thumb-${job.originalName}.png`)}>
                      <a href={thumbnailUrl} download>
                        Download
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}