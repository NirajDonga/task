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
      // Filter to show only CONVERSION jobs
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
        
        {/* Navigation Buttons */}
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

      <div className="grid gap-4">
        {jobs.map((job) => {
          const fileUrl = job.convertedUrl ? `${apiBaseUrl}${job.convertedUrl}` : '';
          
          return (
            <Card key={job._id} className="p-4 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="font-medium">{job.originalName}</span>
                <span className="text-sm text-gray-500">
                    Status: <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>{job.status}</Badge>
                </span>
              </div>

              {job.status === 'completed' && fileUrl && (
                <div className="flex gap-2">
                   <Button variant="outline" size="sm" asChild>
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer">View</a>
                   </Button>
                   <Button size="sm" onClick={() => {
                       const ext = job.originalName.match(/\.(png|jpg|jpeg)$/i) ? 'webp' : 'webm';
                       downloadFile(fileUrl, `converted-${job.originalName.split('.')[0]}.${ext}`)
                   }}>
                      Download
                   </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}