'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ShieldAlert, Lock, User as UserIcon, UserCheck, Stethoscope, HeartHandshake } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'doctor' | 'patient'>('doctor');
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration fields
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'Male' | 'Female' | 'Other'>('Male');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    if (isRegistering && role === 'patient' && !name) {
      setError('Please enter your full name.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      if (isRegistering) {
        // Handle Registration
        const registerUrl = role === 'patient' 
          ? `${apiBase}/api/auth/register/patient` 
          : `${apiBase}/api/auth/register/doctor`;
        
        const payload = role === 'patient' 
          ? { username, password, name, age: parseInt(age) || 40, sex }
          : { username, password };

        const response = await fetch(registerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Registration failed.');
        }

        setSuccess('Registration successful! Please sign in with your credentials.');
        setIsRegistering(false);
        setPassword('');
      } else {
        // Handle Login
        const response = await fetch(`${apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Login failed. Please check credentials.');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Use replace to avoid back-button returning to login
        router.replace('/');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-radial from-slate-900 via-slate-950 to-black p-6 min-h-screen">
      {/* Header Info */}
      <div className="text-center mb-8 space-y-3 max-w-md">
        <div className="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto text-primary border border-primary/20 shadow-lg shadow-primary/10">
          <Activity className="w-8 h-8 animate-pulse text-primary" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          ECG<span className="text-primary font-medium">enius</span>
        </h1>
        <p className="text-sm text-slate-400">
          Full-Stack Arrhythmia Diagnostic & Cardiac Risk Management Platform
        </p>
      </div>

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6">
        
        {/* Role Toggles */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => { setRole('doctor'); setError(''); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              role === 'doctor' 
                ? 'bg-primary text-white shadow-md shadow-primary/15' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            DOCTOR
          </button>
          <button
            type="button"
            onClick={() => { setRole('patient'); setError(''); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              role === 'patient' 
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/15' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HeartHandshake className="w-4 h-4" />
            PATIENT
          </button>
        </div>

        {/* Mode Toggles */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(false);
              setError('');
              setSuccess('');
            }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              !isRegistering 
                ? 'bg-slate-800 text-white border border-white/10 shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            LOG IN
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegistering(true);
              setError('');
              setSuccess('');
            }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              isRegistering 
                ? 'bg-slate-800 text-white border border-white/10 shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            SIGN UP
          </button>
        </div>

        {/* Tab Headers */}
        <div className="text-center">
          <h2 className="text-lg font-bold text-white">
            {isRegistering ? `Create ${role === 'doctor' ? 'Doctor' : 'Patient'} Account` : `${role === 'doctor' ? 'Doctor' : 'Patient'} Portal`}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isRegistering ? 'Provide your registration information below' : 'Authorized Access System'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
            <UserCheck className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Patient Details during registration */}
          {isRegistering && role === 'patient' && (
            <>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    className="w-full h-11 pl-9 pr-3 text-sm border border-white/10 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-slate-900 bg-slate-950/40 text-white transition-colors"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Age
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="45"
                    className="w-full h-11 px-3 text-sm border border-white/10 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-slate-900 bg-slate-950/40 text-white transition-colors"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Sex
                  </label>
                  <select
                    className="w-full h-11 px-2 text-sm border border-white/10 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-slate-900 bg-slate-950/40 text-white transition-colors"
                    value={sex}
                    onChange={(e) => setSex(e.target.value as 'Male' | 'Female' | 'Other')}
                  >
                    <option value="Male" className="bg-slate-900">Male</option>
                    <option value="Female" className="bg-slate-900">Female</option>
                    <option value="Other" className="bg-slate-900">Other</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder={isRegistering ? "Pick a unique username" : (role === 'doctor' ? "doctor" : "patient username")}
                className={`w-full h-11 pl-9 pr-3 text-sm border border-white/10 rounded-xl focus:outline-none focus:bg-slate-900 bg-slate-950/40 text-white transition-colors ${
                  role === 'patient' ? 'focus:border-teal-500' : 'focus:border-primary'
                }`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                placeholder="••••••••"
                className={`w-full h-11 pl-9 pr-3 text-sm border border-white/10 rounded-xl focus:outline-none focus:bg-slate-900 bg-slate-950/40 text-white transition-colors ${
                  role === 'patient' ? 'focus:border-teal-500' : 'focus:border-primary'
                }`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            className={`w-full h-11 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
              role === 'patient' 
                ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/10' 
                : 'bg-primary hover:bg-primary-hover shadow-primary/10'
            }`}
            disabled={isLoading}
          >
            {isLoading 
              ? (isRegistering ? 'Creating Account...' : 'Authenticating...') 
              : (isRegistering ? 'Sign Up' : 'Log In')}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setSuccess('');
              setUsername('');
              setPassword('');
              setName('');
              setAge('');
            }}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            {isRegistering ? 'Already have an account? Log In' : "Don't have an account? Sign Up Now"}
          </button>
        </div>

        <div className="border-t border-white/10 pt-4 text-center">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            HIPAA-compliant and secure. All user events, file validation actions, and diagnosis outcomes are encrypted in the audit logs.
          </p>
        </div>
      </div>
    </div>
  );
}
