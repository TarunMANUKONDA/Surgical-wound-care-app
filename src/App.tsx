import { useState, useCallback, useEffect } from 'react';
import { Screen, WoundImage, PatientAnswers, WoundType } from './types';
import { HomeScreen } from './screens/HomeScreen';
import { UploadScreen } from './screens/UploadScreen';
import { QuestionsScreen } from './screens/QuestionsScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { CareAdviceScreen } from './screens/CareAdviceScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ChatAssistantScreen } from './screens/ChatAssistantScreen';
import { WoundTypesScreen } from './screens/WoundTypesScreen';
import { WoundDetailScreen } from './screens/WoundDetailScreen';
import { VisualLibraryScreen } from './screens/VisualLibraryScreen';
import { HealingLevelsScreen } from './screens/HealingLevelsScreen';
import { DailyTipsScreen } from './screens/DailyTipsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { WoundProgressScreen } from './screens/WoundProgressScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { OTPVerificationScreen } from './screens/OTPVerificationScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { AnalysisProvider, useAnalysis } from './context/AnalysisContext';
import { AppSettingsProvider } from './context/AppSettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { woundAnalysisService, CareRecommendation } from './services/WoundAnalysisService';
import { NotificationSettingsScreen } from './screens/NotificationSettingsScreen';
import { HelpSupportScreen } from './screens/HelpSupportScreen';

// Onboarding helper functions
const hasSeenOnboarding = (): boolean => {
  return localStorage.getItem('hasSeenOnboarding') === 'true';
};

const markOnboardingSeen = () => {
  localStorage.setItem('hasSeenOnboarding', 'true');
};

function AppContent() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState(hasSeenOnboarding);

  // Determine initial screen based on auth state
  const getInitialScreen = (): Screen => {
    if (!hasOnboarded) return 'onboarding';
    if (!isAuthenticated) return 'login';
    return 'home';
  };

  const [currentScreen, setCurrentScreen] = useState<Screen>(getInitialScreen);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [patientAnswers, setPatientAnswers] = useState<PatientAnswers | null>(null);
  const [selectedWoundType, setSelectedWoundType] = useState<WoundType | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedWoundForProgress, setSelectedWoundForProgress] = useState<WoundImage | null>(null);
  const [careRecommendations, setCareRecommendations] = useState<CareRecommendation[]>([]);
  const [otpEmail, setOtpEmail] = useState<string>('');

  // Auth handlers
  const handleLogout = useCallback(async () => {
    await logout();
    setCurrentScreen('login');
  }, [logout]);

  // Handle onboarding completion
  useEffect(() => {
    if (currentScreen === 'login' && !hasOnboarded) {
      markOnboardingSeen();
      setHasOnboarded(true);
    }
  }, [currentScreen, hasOnboarded]);

  // Redirect to login if not authenticated (and not on auth screens)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasOnboarded) {
      if (!['onboarding', 'login', 'signup', 'forgot-password'].includes(currentScreen)) {
        setCurrentScreen('login');
      }
    }
  }, [isAuthenticated, isLoading, currentScreen, hasOnboarded]);

  const {
    woundHistory,
    currentAnalysis,
    setCurrentAnalysis,
    comparisonResult,
    setCurrentImage,
    analyzeImage,
    compareWithPrevious,
    saveToHistory
  } = useAnalysis();

  // Convert context wound history to WoundImage format for components
  const convertedHistory: WoundImage[] = woundHistory.map(w => ({
    id: w.id,
    url: w.imageData,
    date: new Date(w.timestamp),
    status: w.analysis.riskLevel,
    healingStage: w.analysis.healingStage,
    notes: w.notes,
  }));

  const navigate = useCallback((screen: Screen) => {
    setCurrentScreen(screen);
  }, []);

  const handleImageUpload = useCallback((imageUrl: string) => {
    setUploadedImage(imageUrl);
    setCurrentImage(imageUrl);
  }, [setCurrentImage]);

  const handleAnswersSubmit = useCallback(async (answers: PatientAnswers) => {
    setPatientAnswers(answers);

    // Map answers to service format
    const serviceAnswers = {
      daysSinceSurgery: answers.daysSinceSurgery,
      painLevel: answers.painLevel,
      dischargeType: answers.discharge,
      hasFever: answers.fever,
      rednessSpread: answers.rednessSpread,
      dressingChanged: answers.dressingChanged
    };

    // If we have an image, perform full analysis
    if (uploadedImage && currentAnalysis) {
      let analysisToUse = currentAnalysis;

      // 1. Fetch Personalized Recommendations from Backend
      try {
        const personalized = await woundAnalysisService.getPersonalizedRecommendations(currentAnalysis, serviceAnswers);

        if (personalized && personalized.success) {
          // 2. Merge new data into analysis
          const backendRisk = personalized.risk_level || 'Normal';
          let mappedRisk: 'normal' | 'warning' | 'infected' | 'critical' = 'normal';

          if (backendRisk.includes('Critical')) mappedRisk = 'critical';
          else if (backendRisk.includes('High') || backendRisk.includes('Infected')) mappedRisk = 'infected';
          else if (backendRisk.includes('Moderate')) mappedRisk = 'warning';

          analysisToUse = {
            ...currentAnalysis,
            riskLevel: mappedRisk,
            overallHealth: personalized.severity_score ? Math.max(0, 100 - Math.round(personalized.severity_score / 3)) : currentAnalysis.overallHealth,
            backendResults: {
              ...currentAnalysis.backendResults,
              recommendation: personalized.recommendation,
              raw_risk: personalized.risk_level
            },
            detectedFeatures: [
              ...currentAnalysis.detectedFeatures.filter(f => !f.startsWith('Risk:')),
              `Risk: ${personalized.risk_level} (Symptom Adjusted)`
            ]
          };

          // Update context
          setCurrentAnalysis(analysisToUse);
        }
      } catch (e) {
        console.error("Error fetching personalized recs:", e);
      }

      // 3. Generate local care cards (now using updated backend data)
      const recs = woundAnalysisService.generateCareRecommendations(analysisToUse, {
        daysSinceSurgery: answers.daysSinceSurgery,
        painLevel: answers.painLevel,
        dischargeType: answers.discharge,
        hasFever: answers.fever,
        rednessSpread: answers.rednessSpread,
        dressingChanged: answers.dressingChanged,
      });
      setCareRecommendations(recs);

      // 4. Compare with previous if exists (using updated analysis)
      if (woundHistory.length > 0) {
        compareWithPrevious(analysisToUse);
      }
    }

    navigate('preview');
  }, [navigate, uploadedImage, currentAnalysis, woundHistory, compareWithPrevious]);

  const handleAddToHistory = useCallback(() => {
    saveToHistory();
  }, [saveToHistory]);

  const handleSelectWoundType = useCallback((woundType: WoundType) => {
    setSelectedWoundType(woundType);
    navigate('wound-detail');
  }, [navigate]);

  const handleSelectWound = useCallback((wound: WoundImage) => {
    setSelectedWoundForProgress(wound);
    navigate('wound-progress');
  }, [navigate]);

  const handleAddNewScan = useCallback(async (newImage: WoundImage) => {
    // Analyze the new image
    await analyzeImage(newImage.url);
  }, [analyzeImage]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'onboarding':
        return <OnboardingScreen onNavigate={navigate} />;
      case 'login':
        return <LoginScreen onNavigate={navigate} />;
      case 'signup':
        return <SignUpScreen onNavigate={navigate} onSignupSuccess={(email) => { setOtpEmail(email); navigate('otp-verify'); }} />;
      case 'otp-verify':
        return <OTPVerificationScreen email={otpEmail} onNavigate={navigate} onVerified={() => navigate('home')} />;
      case 'forgot-password':
        return <ForgotPasswordScreen onNavigate={navigate} />;
      case 'home':
        return <HomeScreen onNavigate={navigate} />;
      case 'upload':
        return (
          <UploadScreen
            onNavigate={navigate}
            onImageUpload={handleImageUpload}
            uploadedImage={uploadedImage}
          />
        );
      case 'questions':
        return (
          <QuestionsScreen
            onNavigate={navigate}
            onSubmit={handleAnswersSubmit}
          />
        );
      case 'preview':
        return (
          <PreviewScreen
            onNavigate={navigate}
            currentImage={uploadedImage}
            previousImage={convertedHistory[0]?.url || null}
            compareMode={compareMode}
            onToggleCompare={() => setCompareMode(!compareMode)}
            analysis={currentAnalysis}
            comparison={comparisonResult}
          />
        );
      case 'progress':
        return (
          <ProgressScreen
            onNavigate={navigate}
            patientAnswers={patientAnswers}
            analysis={currentAnalysis}
          />
        );
      case 'advice':
        return (
          <CareAdviceScreen
            onNavigate={navigate}
            patientAnswers={patientAnswers}
            onSaveToHistory={handleAddToHistory}
            analysis={currentAnalysis}
            recommendations={careRecommendations}
          />
        );
      case 'history':
        return (
          <HistoryScreen
            onNavigate={navigate}
            history={convertedHistory}
            onSelectWound={handleSelectWound}
          />
        );
      case 'wound-progress':
        return (
          <WoundProgressScreen
            onNavigate={navigate}
            woundHistory={convertedHistory}
            onAddNewScan={handleAddNewScan}
            selectedWound={selectedWoundForProgress}
          />
        );
      case 'chat':
        return (
          <ChatAssistantScreen
            onNavigate={navigate}
          />
        );
      case 'wound-types':
        return (
          <WoundTypesScreen
            onNavigate={navigate}
            onSelectType={handleSelectWoundType}
          />
        );
      case 'wound-detail':
        return (
          <WoundDetailScreen
            onNavigate={navigate}
            woundType={selectedWoundType}
          />
        );
      case 'visual-library':
        return <VisualLibraryScreen onNavigate={navigate} />;
      case 'healing-levels':
        return <HealingLevelsScreen onNavigate={navigate} />;
      case 'daily-tips':
        return <DailyTipsScreen onNavigate={navigate} />;
      case 'profile':
        return <ProfileScreen onNavigate={navigate} onLogout={handleLogout} currentUser={user} />;
      case 'notification-settings':
        return <NotificationSettingsScreen onNavigate={navigate} />;
      case 'help-support':
        return <HelpSupportScreen onNavigate={navigate} />;
      default:
        return <HomeScreen onNavigate={navigate} />;
    }
  };

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FBFF] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#2F80ED] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FBFF] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {renderScreen()}
    </div>
  );
}

export function App() {
  return (
    <AppSettingsProvider>
      <AuthProvider>
        <AnalysisProvider>
          <AppContent />
        </AnalysisProvider>
      </AuthProvider>
    </AppSettingsProvider>
  );
}
