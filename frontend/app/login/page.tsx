'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? '/login' : '/signup';
      const { data } = await api.post(endpoint, { email, password });

      if (isLogin) {
        localStorage.setItem('token', data.token);
        router.push('/dashboard');
      } else {
        alert('Account created! Please log in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <Card className="w-87.5">
        <CardHeader>
          <CardTitle className="text-center">{isLogin ? 'Login' : 'Sign Up'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input 
              placeholder="Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
            <Input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
            <Button type="submit" className="w-full">
              {isLogin ? 'Log In' : 'Sign Up'}
            </Button>
          </form>
          <p 
            className="text-sm text-center mt-4 text-blue-500 cursor-pointer"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "No account? Sign up" : "Have an account? Log in"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}