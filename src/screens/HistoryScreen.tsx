import { useState } from 'react';
import { Screen, WoundImage, WoundCase } from '../types';
import { useAnalysis } from '../context/AnalysisContext';

interface HistoryScreenProps {
  onNavigate: (screen: Screen) => void;
  history: WoundImage[];
  onSelectWound: (wound: WoundImage) => void;
}

export function HistoryScreen({ onNavigate, history, onSelectWound }: HistoryScreenProps) {
  const { woundCases, createNewCase, setCurrentCase } = useAnalysis();
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [newCaseName, setNewCaseName] = useState('');
  const [newCaseDesc, setNewCaseDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'New';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleCreateCase = async () => {
    if (!newCaseName.trim()) return;
    setIsCreating(true);
    try {
      const newCase = await createNewCase(newCaseName, newCaseDesc);
      setShowNewCaseModal(false);
      setNewCaseName('');
      setNewCaseDesc('');
      // Auto-select and navigate
      setCurrentCase(newCase);
      onNavigate('wound-progress');
    } catch (e) {
      console.error("Failed to create case", e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectCase = (woundCase: WoundCase) => {
    setCurrentCase(woundCase);
    onNavigate('wound-progress');
  };

  return (
    <div className="min-h-screen bg-[#F9FBFF] p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between pt-4 pb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('home')}
            className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">My Cases</h1>
            <p className="text-sm text-gray-500">{woundCases.length} active cases</p>
          </div>
        </div>

        <button
          onClick={() => setShowNewCaseModal(true)}
          className="w-10 h-10 bg-[#8B5CF6] rounded-xl shadow-md flex items-center justify-center text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Cases List */}
      {woundCases.length > 0 ? (
        <div className="space-y-4">
          {woundCases.map((woundCase) => (
            <button
              key={woundCase.id}
              onClick={() => handleSelectCase(woundCase)}
              className="w-full bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-shadow text-left"
            >
              <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                  {woundCase.latestImage ? (
                    <img
                      src={woundCase.latestImage}
                      alt={woundCase.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-800 text-lg">{woundCase.name}</h3>
                    <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {woundCase.woundCount} scans
                    </span>
                  </div>

                  {woundCase.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{woundCase.description}</p>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Started {formatDate(woundCase.createdAt)}</span>
                  </div>
                </div>

                {/* Arrow */}
                <svg className="w-5 h-5 text-gray-300 self-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Cases Yet</h3>
          <p className="text-gray-500 max-w-xs mb-6">Create a case to start tracking a specific wound's healing progress.</p>
          <button
            onClick={() => setShowNewCaseModal(true)}
            className="bg-[#8B5CF6] text-white px-6 py-3 rounded-xl font-medium shadow-md flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Case
          </button>
        </div>
      )}

      {/* New Case Modal */}
      {showNewCaseModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">New Wound Case</h2>
              <button onClick={() => setShowNewCaseModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Name</label>
                <input
                  type="text"
                  placeholder="e.g. Right Leg Surgery"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                  value={newCaseName}
                  onChange={(e) => setNewCaseName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Notes about this wound..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] h-24 resize-none"
                  value={newCaseDesc}
                  onChange={(e) => setNewCaseDesc(e.target.value)}
                />
              </div>

              <button
                onClick={handleCreateCase}
                disabled={!newCaseName.trim() || isCreating}
                className="w-full bg-[#8B5CF6] text-white py-3 rounded-xl font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating && (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Create Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
