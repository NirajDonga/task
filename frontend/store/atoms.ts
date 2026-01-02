import { atom } from 'jotai';

export interface Job {
  _id: string;
  originalName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  thumbnailUrl?: string;
  createdAt: string;
}

export const jobsAtom = atom<Job[]>([]);
export const uploadingAtom = atom<boolean>(false);