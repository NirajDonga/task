'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client'; 
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? apiBaseUrl;

// Placeholder for when content is loading or if there's an error
const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='14' fill='%239ca3af' text-anchor='middle' dy='.3em'%3ENo Preview%3C/text%3E%3C/svg%3E";

interface Job {
  _id: string;
  originalName: string;
  status: string;
  type: string;
  convertedUrl?: string;
  createdAt: string;
}

export default function ConverterPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchJobs = async () => {
    try {
      const { data } = await api.get('/jobs');
      setJobs(data.filter((j: Job) => j.type === 'conversion'));
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

    socket.on('job-completed', (data: any) => {
      setJobs((prev) => prev.map(job => 
        job._id === data.jobId 
          ? { ...job, status: 'completed', convertedUrl: data.convertedUrl } 
          : job
      ));
    });

    socket.on('job-failed', (data: any) => {
      setJobs((prev) => prev.map(job => 
        job._id === data.jobId ? { ...job, status: 'failed' } : job
      ));
    });

    return () => { socket.disconnect(); };
  }, [router]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return; 
    setUploading(true);
    const formData = new FormData();
    Array.from(e.target.files).forEach((file) => formData.append('files', file));

    try {
      const { data } = await api.post('/convert', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const newJobs = data.jobs.map((job: any) => ({
        _id: job.jobId, 
        originalName: job.originalName, 
        status: 'queued',
        type: 'conversion',
        createdAt: new Date().toISOString()
      }));
      setJobs(prev => [...newJobs, ...prev]);
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

  const downloadFile = async (url: string, filename: string) => {
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
        <h1 className="text-3xl font-bold">Media Converter</h1>
        
        <div className="flex gap-3">
            <Button onClick={() => router.push('/dashboard')} variant="secondary">
                Back to Dashboard
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
              {uploading ? 'Converting...' : 'Convert Video/Image'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map((job) => {
          const fileUrl = job.convertedUrl ? `${apiBaseUrl}${job.convertedUrl}` : null;
          
          return (
            <Card key={job._id} className="overflow-hidden flex flex-col">
              <div className="h-40 bg-gray-100 flex items-center justify-center relative">
                {job.status === 'completed' && fileUrl ? (
                  // Check if the output file is a video (WebM) or image (WebP)
                  fileUrl.endsWith('.webm') ? (
                     <video 
                       src={fileUrl} 
                       className="w-full h-full object-cover" 
                       controls 
                     />
                  ) : (
                    <img 
                      src={fileUrl} 
                      alt="Converted Preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => { 
                        const target = e.target as HTMLImageElement;
                        target.onerror = null; 
                        target.src = PLACEHOLDER_IMAGE;
                      }}
                    />
                  )
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

                {job.status === 'completed' && fileUrl && (
                  <div className="flex gap-2 mt-auto pt-2">
                     <Button variant="outline" size="sm" className="flex-1" asChild>
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer">View</a>
                     </Button>
                     <Button size="sm" className="flex-1" onClick={() => {
                         const ext = job.originalName.match(/\.(png|jpg|jpeg)$/i) ? 'webp' : 'webm';
                         downloadFile(fileUrl, `converted-${job.originalName.split('.')[0]}.${ext}`)
                     }}>
                        Download
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