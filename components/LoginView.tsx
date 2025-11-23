import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/authService';
import Button from './ui/Button';

const LoginView: React.FC = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const user = await login(username, pin);
            if (user) {
                navigate('/');
            } else {
                setError('Invalid username or PIN');
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-ios animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
                    <p className="text-slate-500 mt-2">Enter your credentials to access TaskMaster</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                            placeholder="Enter username"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Security PIN</label>
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-slate-900 font-medium focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400 tracking-widest"
                            placeholder="••••"
                            maxLength={4}
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl text-center animate-in fade-in">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full justify-center py-3.5 text-base"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Verifying...' : 'Unlock Dashboard'}
                    </Button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-400">
                        TaskMaster Pro v1.2.0 • Secure Access
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginView;
