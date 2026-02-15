import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppSettings } from '../types';

interface AppSettingsContextType {
    settings: AppSettings;
    profileImage: string | null;
    setProfileImage: (image: string | null) => void;
    toggleDarkMode: () => void;
    setLanguage: (language: AppSettings['language']) => void;
    updateNotificationSetting: (key: keyof AppSettings['notifications'], value: boolean) => void;
}

const defaultSettings: AppSettings = {
    darkMode: false,
    language: 'en',
    notifications: {
        push: true,
        email: true,
        dailyTips: true,
        progressReminders: true,
    },
};

const AppSettingsContext = createContext<AppSettingsContextType | null>(null);

export const useAppSettings = () => {
    const context = useContext(AppSettingsContext);
    if (!context) {
        throw new Error('useAppSettings must be used within AppSettingsProvider');
    }
    return context;
};

// Load settings from localStorage
const loadSettings = (): AppSettings => {
    try {
        const saved = localStorage.getItem('appSettings');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load app settings:', e);
    }
    return defaultSettings;
};

// Load profile image from localStorage
const loadProfileImage = (): string | null => {
    try {
        return localStorage.getItem('profileImage');
    } catch (e) {
        console.error('Failed to load profile image:', e);
    }
    return null;
};

// Save settings to localStorage
const saveSettings = (settings: AppSettings) => {
    try {
        localStorage.setItem('appSettings', JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save app settings:', e);
    }
};

// Save profile image to localStorage
const saveProfileImage = (image: string | null) => {
    try {
        if (image) {
            localStorage.setItem('profileImage', image);
        } else {
            localStorage.removeItem('profileImage');
        }
    } catch (e) {
        console.error('Failed to save profile image:', e);
    }
};

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(loadSettings);
    const [profileImage, setProfileImageState] = useState<string | null>(loadProfileImage);

    // Save settings to localStorage whenever they change
    useEffect(() => {
        saveSettings(settings);
    }, [settings]);

    const setProfileImage = useCallback((image: string | null) => {
        setProfileImageState(image);
        saveProfileImage(image);
    }, []);

    const toggleDarkMode = useCallback(() => {
        setSettings(prev => ({
            ...prev,
            darkMode: !prev.darkMode,
        }));
    }, []);

    const setLanguage = useCallback((language: AppSettings['language']) => {
        setSettings(prev => ({
            ...prev,
            language,
        }));
    }, []);

    const updateNotificationSetting = useCallback(
        (key: keyof AppSettings['notifications'], value: boolean) => {
            setSettings(prev => ({
                ...prev,
                notifications: {
                    ...prev.notifications,
                    [key]: value,
                },
            }));
        },
        []
    );

    return (
        <AppSettingsContext.Provider
            value={{
                settings,
                profileImage,
                setProfileImage,
                toggleDarkMode,
                setLanguage,
                updateNotificationSetting,
            }}
        >
            {children}
        </AppSettingsContext.Provider>
    );
};
