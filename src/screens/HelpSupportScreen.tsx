import { useState } from 'react';
import { Screen } from '../types';

interface HelpSupportScreenProps {
    onNavigate: (screen: Screen) => void;
}

export function HelpSupportScreen({ onNavigate }: HelpSupportScreenProps) {
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

    const faqs = [
        {
            question: 'How do I upload a wound image?',
            answer: 'Navigate to the home screen and tap the "Upload" button. You can either take a photo with your camera or select an existing image from your gallery.',
        },
        {
            question: 'How accurate is the AI analysis?',
            answer: 'Our AI provides preliminary analysis to help you monitor wound progress. However, it should not replace professional medical advice. Always consult with your healthcare provider for serious concerns.',
        },
        {
            question: 'How often should I scan my wound?',
            answer: 'For optimal progress tracking, we recommend scanning your wound every 2-3 days, or as directed by your healthcare provider.',
        },
        {
            question: 'Can I delete wound history?',
            answer: 'Currently, wound history is stored locally on your device. You can clear all data by clearing your browser storage or app data.',
        },
        {
            question: 'What if I notice signs of infection?',
            answer: 'If you notice increased redness, swelling, pus, fever, or severe pain, seek immediate medical attention. Do not rely solely on the app for infection diagnosis.',
        },
    ];

    const supportOptions = [
        {
            title: 'Chat with AI Assistant',
            description: 'Get instant answers to your questions',
            icon: (
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
            ),
            action: 'chat' as Screen,
            bgColor: 'bg-blue-50',
        },
        {
            title: 'Daily Care Tips',
            description: 'View helpful wound care tips',
            icon: (
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
            ),
            action: 'daily-tips' as Screen,
            bgColor: 'bg-green-50',
        },
        {
            title: 'Visual Library',
            description: 'Browse wound healing references',
            icon: (
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            action: 'visual-library' as Screen,
            bgColor: 'bg-purple-50',
        },
    ];

    return (
        <div className="min-h-screen bg-[#F9FBFF] p-4 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 pt-4 pb-6">
                <button
                    onClick={() => onNavigate('profile')}
                    className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">Help & Support</h1>
                    <p className="text-sm text-gray-500">Get assistance and learn more</p>
                </div>
            </div>

            {/* Support Options */}
            <div className="mb-6 space-y-3">
                {supportOptions.map((option) => (
                    <button
                        key={option.title}
                        onClick={() => onNavigate(option.action)}
                        className={`w-full ${option.bgColor} rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                {option.icon}
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="font-semibold text-gray-800">{option.title}</h3>
                                <p className="text-sm text-gray-600">{option.description}</p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>
                ))}
            </div>

            {/* FAQ Section */}
            <div className="bg-white rounded-2xl p-4 shadow-md mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="font-semibold text-gray-800">Frequently Asked Questions</h3>
                </div>

                <div className="space-y-2">
                    {faqs.map((faq, index) => (
                        <div key={index} className="border-b border-gray-100 last:border-0">
                            <button
                                onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                                className="w-full flex items-center justify-between py-3 text-left"
                            >
                                <span className="font-medium text-gray-800 pr-4">{faq.question}</span>
                                <svg
                                    className={`w-5 h-5 text-gray-400 transform transition-transform flex-shrink-0 ${openFaqIndex === index ? 'rotate-180' : ''
                                        }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {openFaqIndex === index && (
                                <div className="pb-3 text-sm text-gray-600">
                                    {faq.answer}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Contact Info */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                <h3 className="text-lg font-semibold mb-2">Need More Help?</h3>
                <p className="text-sm text-blue-50 mb-4">
                    Our AI assistant is available 24/7 to answer your wound care questions.
                </p>
                <button
                    onClick={() => onNavigate('chat')}
                    className="w-full bg-white text-blue-600 py-3 px-4 rounded-xl font-medium hover:bg-blue-50 transition-colors"
                >
                    Chat with Assistant
                </button>
            </div>

            {/* App Version */}
            <p className="text-center text-xs text-gray-400 mt-6">
                WoundCare AI v1.0.0
            </p>
        </div>
    );
}
