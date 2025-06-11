// app/login/page.tsx
'use client'; // This is a client component

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
// Non useremo più Label e Input direttamente, ma faremo l'input custom
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Aggiungi uno stato di caricamento
  const router = useRouter();

  const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    setIsLoading(true); // Imposta lo stato di caricamento

    try {
      const response = await fetch(`${STRAPI_URL}/api/auth/local`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: email, // Strapi uses 'identifier' for email/username
          password: password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error.message || 'Login failed. Please check your credentials.');
        return;
      }

      const data = await response.json();

      console.log(data)
      localStorage.setItem('jwt', data.jwt); 
      localStorage.setItem('username', data.user.username);
      router.push('/'); // Redirect to home page after successful login
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false); // Disattiva lo stato di caricamento
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-primary">Login</h1>
        <form onSubmit={handleLogin} className="space-y-6"> {/* Aumentato lo spazio tra gli elementi */}
          {/* Email Input */}
          <div className="relative z-0 w-full group">
            <input
              type="text" name="email" id="email"
              className="block py-2.5 px-0 w-full text-sm text-foreground bg-transparent border-0 border-b-2 border-input appearance-none focus:outline-none focus:ring-0 focus:border-primary peer pl-2"
              placeholder=" " required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading}
            />
            <label htmlFor="email" className="peer-focus:font-medium absolute text-sm text-muted-foreground duration-300 transform -translate-y-8 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-8">
              Email / Username
            </label>
          </div>

          {/* Password Input */}
          <div className="relative z-0 w-full group">
            <input
              type="password" name="password" id="password"
              className="block py-2.5 px-0 w-full text-sm text-foreground bg-transparent border-0 border-b-2 border-input appearance-none focus:outline-none focus:ring-0 focus:border-primary peer pl-2"
              placeholder=" " required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading}
            />
            <label htmlFor="password" className="peer-focus:font-medium absolute text-sm text-muted-foreground duration-300 transform -translate-y-8 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-8">
              Password
            </label>
          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </div>
    </main>
  );
}