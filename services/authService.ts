import PocketBase from 'pocketbase';
import { User } from '../types';

// Initialize PocketBase (Same instance as dataService ideally, but new instance is fine for now as it's stateless mostly)
const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090');

export const login = async (username: string, pin: string): Promise<User | null> => {
    try {
        // 1. Find user by username
        // Note: We are using a public list search here. In a real secure app, we wouldn't expose users list publicly.
        // But for this "Pin Login" requirement without password, we assume we can query users.
        // If 'users' collection is locked, this will fail. We assume it's readable.
        const result = await pb.collection('users').getList(1, 1, {
            filter: `username = "${username}" && pin = "${pin}"`,
        });

        if (result.items.length > 0) {
            const user = result.items[0] as unknown as User;
            // Persist simple auth state in localStorage since we aren't using PB's token auth for this custom PIN flow
            localStorage.setItem('currentUser', JSON.stringify(user));
            return user;
        }
        return null;
    } catch (error) {
        console.error('Login failed:', error);
        return null;
    }
};

export const logout = () => {
    localStorage.removeItem('currentUser');
    pb.authStore.clear();
};

export const getCurrentUser = (): User | null => {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
};

export const isAuthenticated = (): boolean => {
    return !!getCurrentUser();
};
