const API_HOST = import.meta.env.VITE_API_HOST || 'localhost:8000';
const API_BASE_URL = `http://${API_HOST}/api`;

export interface User {
    id: number;
    name: string;
    email: string;
    email_verified: boolean;
    phone?: string;
    dateOfBirth?: string;
    bloodType?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
    profileImage?: string;
    createdAt: Date;
}

export interface AuthResponse {
    success: boolean;
    user?: User;
    session_token?: string;
    expires_at?: string;
    error?: string;
}

class AuthService {
    private sessionToken: string | null = null;

    constructor() {
        // Load session from localStorage on initialization
        this.sessionToken = localStorage.getItem('session_token');
    }

    async signup(name: string, email: string, password: string): Promise<any> {
        try {
            const response = await fetch(`${API_BASE_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            // New response format: { success, message, email, otp_sent }
            return data;
        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, error: 'Network error during signup' };
        }
    }

    async login(email: string, password: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success && data.session_token) {
                this.sessionToken = data.session_token;
                localStorage.setItem('session_token', data.session_token);
                localStorage.setItem('user', JSON.stringify(data.user));
            }

            return data;
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, error: `Login failed: ${errorMessage}` };
        }
    }

    async logout(): Promise<void> {
        if (!this.sessionToken) return;

        try {
            await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_token: this.sessionToken })
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.sessionToken = null;
            localStorage.removeItem('session_token');
            localStorage.removeItem('user');
        }
    }

    async verifySession(): Promise<User | null> {
        if (!this.sessionToken) return null;

        try {
            const response = await fetch(`${API_BASE_URL}/verify_session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_token: this.sessionToken })
            });

            const data = await response.json();

            if (data.success && data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
                return data.user;
            } else {
                // Session invalid, clear storage
                this.sessionToken = null;
                localStorage.removeItem('session_token');
                localStorage.removeItem('user');
                return null;
            }
        } catch (error) {
            console.error('Session verification error:', error);
            return null;
        }
    }

    getCurrentUser(): User | null {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }

    isAuthenticated(): boolean {
        return this.sessionToken !== null && localStorage.getItem('user') !== null;
    }

    getSessionToken(): string | null {
        return this.sessionToken;
    }
}

export const authService = new AuthService();
