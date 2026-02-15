import { useState, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { Screen, WoundImage, HealingStage } from '../types';
import { useAnalysis } from '../context/AnalysisContext';
import { backendAPI } from '../services/BackendAPIService';

interface WoundProgressScreenProps {
  onNavigate: (screen: Screen) => void;
  woundHistory: WoundImage[];
  onAddNewScan: (image: WoundImage) => void;
  selectedWound?: WoundImage | null;
}

const stageOrder: HealingStage[] = ['hemostasis', 'inflammatory', 'proliferative', 'maturation'];

export function WoundProgressScreen({ onNavigate, woundHistory, onAddNewScan, selectedWound }: WoundProgressScreenProps) {
  const {
    isAnalyzing,
    analyzeImage,
    compareWithPrevious,
    compareWithSpecificWound,
    woundHistory: contextHistory,
    addWoundToHistory,
    currentCase
  } = useAnalysis();
  const [beforeIndex, setBeforeIndex] = useState(0);
  const [afterIndex, setAfterIndex] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use context history if available, otherwise use props
  const actualHistory = contextHistory.length > 0 ? contextHistory.map(w => ({
    id: w.id,
    url: w.imageData,
    date: new Date(w.timestamp),
    status: w.analysis.riskLevel as any,
    healingStage: w.analysis.healingStage,
    analysis: w.analysis,
  })) : woundHistory;

  // Sort history by date (newest first)
  const sortedHistory = useMemo(() => {
    if (!actualHistory || actualHistory.length === 0) return [];
    return [...actualHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [actualHistory]);

  // Initialize comparison indices when history changes
  useMemo(() => {
    if (sortedHistory.length >= 2) {
      setBeforeIndex(sortedHistory.length - 1); // oldest
      setAfterIndex(0); // newest
    }
  }, [sortedHistory.length]);

  // Calculate healing score for a scan
  const getHealingScore = (scan: WoundImage, index: number): number => {
    const stageIndex = stageOrder.indexOf(scan.healingStage);
    const stageProgress = ((stageIndex + 1) / 4) * 100;
    const healthScore = scan.analysis?.overallHealth || (40 + stageIndex * 15);
    const rednessLevel = scan.analysis?.rednessLevel || Math.max(10, 70 - index * 15);
    const edgeQuality = scan.analysis?.edgeQuality || (30 + stageIndex * 20);

    return Math.round(
      (stageProgress * 0.30) +
      (healthScore * 0.25) +
      ((100 - rednessLevel) * 0.25) +
      (edgeQuality * 0.20)
    );
  };

  // Get current healing score
  const currentScore = sortedHistory.length > 0 ? getHealingScore(sortedHistory[0], sortedHistory.length - 1) : 0;

  // Calculate improvement from first scan
  const firstScore = sortedHistory.length > 0 ? getHealingScore(sortedHistory[sortedHistory.length - 1], 0) : 0;
  const improvement = currentScore - firstScore;

  // Generate chart data
  const chartData = useMemo(() => {
    if (!sortedHistory || sortedHistory.length === 0) return [];

    const chronologicalHistory = [...sortedHistory].reverse();

    return chronologicalHistory.map((scan, index) => {
      const score = getHealingScore(scan, index);
      return {
        date: new Date(scan.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
        healingScore: Math.min(100, Math.max(0, score)),
      };
    });
  }, [sortedHistory]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getStatusMessage = (score: number): string => {
    if (score >= 70) return 'Healing well';
    if (score >= 50) return 'Continue current treatment';
    if (score >= 30) return 'Clean wound daily';
    return 'Needs attention';
  };

  const handleCompareAnalyze = async () => {
    const beforeScan = sortedHistory[beforeIndex];
    const afterScan = sortedHistory[afterIndex];

    if (beforeScan && afterScan) {
      // Use async comparison (tries backend Gemini first, falls back to local)
      const comparison = await compareWithSpecificWound(beforeScan.id, afterScan.id);

      if (comparison) {
        setComparisonData(comparison);
        setShowComparisonModal(true);

        // Save the comparison result to backend
        if (currentCase) {
          try {
            await backendAPI.saveComparison(
              currentCase.id.toString(),
              beforeScan.id,
              afterScan.id,
              comparison
            );
            console.log("Comparison saved successfully");
          } catch (err) {
            console.error("Failed to save comparison", err);
          }
        }
      }
    }
  };


  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageUrl = reader.result as string;
        setUploadedImageUrl(imageUrl);
        setShowUploadModal(true);
        setAnalysisComplete(false);

        if (!currentCase) {
          alert("Error: No case selected. Please go back and select a case.");
          setAnalysisComplete(false);
          setShowUploadModal(false);
          return;
        }

        try {
          // 1. Analyze and Upload (simultaneously via service)
          // Passing caseId ensures the upload is linked to the current case
          // The service also handles saving the analysis to the backend
          const analysis = await analyzeImage(imageUrl, currentCase?.id);

          let backendWoundId = Date.now().toString(); // Fallback

          // Extract wound_id from backend results if available
          if (analysis.backendResults?.upload?.wound_id) {
            backendWoundId = analysis.backendResults.upload.wound_id.toString();
          }

          // 3. Compare with most recent scan if available
          let comparison = null;
          if (sortedHistory.length > 0) {
            // Use local comparison for immediate feedback
            comparison = compareWithPrevious(analysis);
          }

          setComparisonData(comparison);
          setAnalysisComplete(true);

          // Define patient answers
          const answers = {
            daysSinceSurgery: 0,
            painLevel: 'none' as const,
            dischargeType: 'no' as const,
            hasFever: false,
            rednessSpread: false,
            dressingChanged: true,
          };

          // 4. Save to history (updates local state)
          // We assume addWoundToHistory handles linking to case based on context
          addWoundToHistory(imageUrl, analysis, answers, comparison);

          // Create and add the new scan
          const newScan: WoundImage = {
            id: backendWoundId,
            caseId: currentCase?.id,
            url: imageUrl,
            date: new Date(),
            status: analysis.riskLevel as any,
            healingStage: analysis.healingStage,
            analysis: analysis,
          };

          onAddNewScan(newScan);
        } catch (error) {
          console.error('Error analyzing image:', error);
          alert("Failed to upload/analyze image. Please checking your connection and try again.");
          setAnalysisComplete(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Empty state
  if (!woundHistory || woundHistory.length === 0) {
    return (
      <div className="min-h-screen bg-[#F9FBFF] p-4">
        <div className="flex items-center gap-4 pt-4 pb-6">
          <button
            onClick={() => onNavigate('history')}
            className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2F80ED] rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-800">Wound History</h1>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Wound Scans Yet</h2>
          <p className="text-gray-500 text-center mb-6 max-w-xs">
            Upload your first wound image to start tracking your healing progress.
          </p>
          <button
            onClick={() => onNavigate('upload')}
            className="bg-gradient-to-r from-[#8B5CF6] to-[#A855F7] text-white px-6 py-3 rounded-xl font-medium shadow-md flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Capture First Image
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FBFF] p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 pt-4 pb-6">
        <button
          onClick={() => onNavigate('history')}
          className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#2F80ED] rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">{currentCase ? currentCase.name : 'Wound History'}</h1>
            {currentCase && <p className="text-sm text-gray-500">Case #{currentCase.id}</p>}
          </div>
        </div>
      </div>

      {/* Healing Status Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 border-l-4 border-[#27AE60]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#27AE60] rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[#27AE60] font-semibold text-lg">Healing</span>
                {improvement > 0 && (
                  <span className="bg-[#27AE60] text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    +{improvement}%
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm">Your wound is healing well!</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[#27AE60] text-3xl font-bold">{currentScore}%</div>
            <p className="text-gray-400 text-xs">Current Score</p>
          </div>
        </div>
      </div>

      {/* Healing Progress Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Healing Progress</h2>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Healing Score %</span>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="healingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  stroke="#E5E7EB"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  stroke="#E5E7EB"
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number | undefined) => value !== undefined ? [`${value}%`, 'Healing Score'] : ['', '']}
                />
                <Area
                  type="monotone"
                  dataKey="healingScore"
                  stroke="none"
                  fill="url(#healingGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="healingScore"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#8B5CF6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Capture New Image Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#A855F7] text-white py-4 rounded-2xl font-medium shadow-lg flex items-center justify-center gap-3 mb-4"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Capture New Image
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Image History */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-800">Image History</h2>
          <p className="text-gray-400 text-sm">{sortedHistory.length} captures</p>
        </div>

        <div className="space-y-3">
          {sortedHistory.map((scan, index) => {
            const score = getHealingScore(scan, sortedHistory.length - 1 - index);
            const redness = scan.analysis?.rednessLevel || Math.max(10, 70 - (sortedHistory.length - 1 - index) * 15);
            const size = 100 - score + 15;

            return (
              <div
                key={scan.id}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                {/* Image with number badge */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-xl overflow-hidden">
                    <img src={scan.url} alt={`Scan ${sortedHistory.length - index}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -top-1 -left-1 w-5 h-5 bg-[#27AE60] rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{sortedHistory.length - index}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDate(scan.date)} • {formatTime(scan.date)}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`font-bold ${score >= 60 ? 'text-[#27AE60]' : score >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {score}% <span className="font-normal text-gray-500">Score</span>
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-500 text-sm">
                      Size: {Math.round(size)}% • Redness: {Math.round(redness)}%
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">{getStatusMessage(score)}</p>
                </div>

                {/* Arrow */}
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Comparison Section */}
      {sortedHistory.length >= 2 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-800">AI Comparison</h2>
            <p className="text-gray-400 text-sm">Compare two images to analyze progress</p>
          </div>

          {/* Dropdowns */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-gray-500 text-sm mb-2 block">Before (Old)</label>
              <select
                value={beforeIndex}
                onChange={(e) => setBeforeIndex(Number(e.target.value))}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              >
                {sortedHistory.map((scan, index) => (
                  <option key={scan.id} value={index}>
                    #{sortedHistory.length - index} - {formatDate(scan.date)} ({getHealingScore(scan, sortedHistory.length - 1 - index)}%)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-sm mb-2 block">After (New)</label>
              <select
                value={afterIndex}
                onChange={(e) => setAfterIndex(Number(e.target.value))}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
              >
                {sortedHistory.map((scan, index) => (
                  <option key={scan.id} value={index}>
                    #{sortedHistory.length - index} - {formatDate(scan.date)} ({getHealingScore(scan, sortedHistory.length - 1 - index)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Image Comparison */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="relative rounded-xl overflow-hidden">
              <img
                src={sortedHistory[beforeIndex].url}
                alt="Before"
                className="w-full h-32 object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <span className="text-white text-sm font-medium">
                  Before: {getHealingScore(sortedHistory[beforeIndex], sortedHistory.length - 1 - beforeIndex)}%
                </span>
              </div>
            </div>
            <div className="relative rounded-xl overflow-hidden">
              <img
                src={sortedHistory[afterIndex].url}
                alt="After"
                className="w-full h-32 object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <span className="text-white text-sm font-medium">
                  After: {getHealingScore(sortedHistory[afterIndex], sortedHistory.length - 1 - afterIndex)}%
                </span>
              </div>
            </div>
          </div>

          {/* Compare Button */}
          <button
            onClick={handleCompareAnalyze}
            className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#A855F7] text-white py-4 rounded-2xl font-medium shadow-lg flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Compare & Analyze
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">New Scan Analysis</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadedImageUrl(null);
                  setAnalysisComplete(false);
                  setComparisonData(null);
                }}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview Image */}
            {uploadedImageUrl && (
              <div className="mb-4 rounded-xl overflow-hidden">
                <img src={uploadedImageUrl} alt="New scan" className="w-full h-48 object-cover" />
              </div>
            )}

            {/* Analyzing State */}
            {isAnalyzing && !analysisComplete && (
              <div className="flex flex-col items-center justify-center py-8">
                <svg className="w-16 h-16 text-[#8B5CF6] animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-700 font-medium mb-2">Analyzing wound...</p>
                <p className="text-gray-500 text-sm">AI is processing your image</p>
              </div>
            )}

            {/* Analysis Complete */}
            {analysisComplete && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="font-semibold text-green-800">Analysis Complete!</h3>
                  </div>
                  <p className="text-sm text-green-700">Your new scan has been analyzed and saved.</p>
                </div>

                {/* Comparison Results */}
                {comparisonData && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 className="font-medium text-gray-800 mb-3">Comparison with Previous Scan</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Redness Level</span>
                        <span className={`text-sm font-medium ${comparisonData.rednessChange > 0 ? 'text-green-600' :
                          comparisonData.rednessChange < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                          {comparisonData.rednessChange > 0 ? '↓' : comparisonData.rednessChange < 0 ? '↑' : '—'}
                          {' '}{Math.abs(comparisonData.rednessChange || 0)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Wound Size</span>
                        <span className={`text-sm font-medium ${comparisonData.sizeChange > 0 ? 'text-red-600' :
                          comparisonData.sizeChange < 0 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                          {comparisonData.sizeChange > 0 ? '↑' : comparisonData.sizeChange < 0 ? '↓' : '—'}
                          {' '}{Math.abs(comparisonData.sizeChange || 0)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Healing Edge</span>
                        <span className={`text-sm font-medium ${comparisonData.edgeHealingChange > 0 ? 'text-green-600' :
                          comparisonData.edgeHealingChange < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                          {comparisonData.edgeHealingChange > 0 ? '↑' : comparisonData.edgeHealingChange < 0 ? '↓' : '—'}
                          {' '}{comparisonData.edgeHealingChange > 0 ? 'Improving' : comparisonData.edgeHealingChange < 0 ? 'Declining' : 'Stable'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                          <span className={`text-lg font-bold ${comparisonData.improvement > 0 ? 'text-green-600' :
                            comparisonData.improvement < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                            {comparisonData.improvement > 0 ? '+' : ''}{comparisonData.improvement || 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadedImageUrl(null);
                    setAnalysisComplete(false);
                    setComparisonData(null);
                  }}
                  className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#A855F7] text-white py-3 rounded-xl font-medium shadow-lg"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comparison Results Modal */}
      {showComparisonModal && comparisonData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Comparison Analysis</h2>
              <button
                onClick={() => setShowComparisonModal(false)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Before and After Images */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Before</p>
                <img
                  src={sortedHistory[beforeIndex]?.url}
                  alt="Before"
                  className="w-full h-32 object-cover rounded-xl"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(sortedHistory[beforeIndex]?.date)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">After</p>
                <img
                  src={sortedHistory[afterIndex]?.url}
                  alt="After"
                  className="w-full h-32 object-cover rounded-xl"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(sortedHistory[afterIndex]?.date)}
                </p>
              </div>
            </div>

            {/* Comparison Metrics */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
              <h3 className="font-medium text-gray-800 mb-3">Comparison Metrics</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Redness Level</span>
                  <span className={`text-sm font-medium ${comparisonData.rednessChange > 0 ? 'text-green-600' :
                    comparisonData.rednessChange < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                    {comparisonData.rednessChange > 0 ? '↓' : comparisonData.rednessChange < 0 ? '↑' : '—'}
                    {' '}{Math.abs(comparisonData.rednessChange || 0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Wound Size</span>
                  <span className={`text-sm font-medium ${comparisonData.sizeChange > 0 ? 'text-red-600' :
                    comparisonData.sizeChange < 0 ? 'text-green-600' : 'text-gray-600'
                    }`}>
                    {comparisonData.sizeChange > 0 ? '↑' : comparisonData.sizeChange < 0 ? '↓' : '—'}
                    {' '}{Math.abs(comparisonData.sizeChange || 0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Healing Edge</span>
                  <span className={`text-sm font-medium ${comparisonData.edgeHealingChange > 0 ? 'text-green-600' :
                    comparisonData.edgeHealingChange < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                    {comparisonData.edgeHealingChange > 0 ? '↑' : comparisonData.edgeHealingChange < 0 ? '↓' : '—'}
                    {' '}{comparisonData.edgeHealingChange > 0 ? 'Improving' : comparisonData.edgeHealingChange < 0 ? 'Declining' : 'Stable'}
                  </span>
                </div>
              </div>
            </div>

            {/* Overall Progress */}
            <div className={`rounded-xl p-4 mb-4 ${comparisonData.improvement > 0 ? 'bg-green-50 border-green-200' :
              comparisonData.improvement < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
              } border`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                <span className={`text-2xl font-bold ${comparisonData.improvement > 0 ? 'text-green-600' :
                  comparisonData.improvement < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                  {comparisonData.improvement > 0 ? '+' : ''}{comparisonData.improvement || 0}%
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {comparisonData.improvement > 0 ? 'Your wound is healing well!' :
                  comparisonData.improvement < 0 ? 'Wound condition has declined. Consider consulting a doctor.' :
                    'Wound condition is stable.'}
              </p>
            </div>

            <button
              onClick={() => setShowComparisonModal(false)}
              className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#A855F7] text-white py-3 rounded-xl font-medium shadow-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
