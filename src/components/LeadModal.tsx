import { motion } from 'framer-motion';
import { useState } from 'react';
import type { LeadFormData } from '../types';
import { Analytics } from '../utils/analytics';

interface LeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: LeadFormData) => void;
}

// Role options matching Truv's contact form
const ROLE_OPTIONS = [
    { value: 'executive', label: 'Executive' },
    { value: 'vp', label: 'VP/SVP/EVP' },
    { value: 'director', label: 'Director' },
    { value: 'manager', label: 'Manager' },
    { value: 'non-manager', label: 'Non-Manager' }
];

// Job Function options matching Truv's contact form
const JOB_FUNCTION_OPTIONS = [
    { value: 'executive', label: 'Executive' },
    { value: 'underwriting', label: 'Underwriting' },
    { value: 'risk-compliance', label: 'Risk & Compliance' },
    { value: 'operations', label: 'Operations' },
    { value: 'engineering-it', label: 'Engineering / IT' },
    { value: 'product-management', label: 'Product Management' },
    { value: 'finance', label: 'Finance' },
    { value: 'other', label: 'Other' }
];

export function LeadModal({ isOpen, onClose, onSubmit }: LeadModalProps) {
    const [formData, setFormData] = useState<LeadFormData>({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: '',
        jobFunction: '',
        comments: '',
        losSystem: '',
        posSystem: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        // HubSpot Configuration - REPLACE THESE WITH YOUR ACTUAL IDS
        const PORTAL_ID = 'YOUR_PORTAL_ID';
        const FORM_GUID = 'YOUR_FORM_GUID';

        try {
            const response = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_GUID}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: [
                        { name: 'firstname', value: formData.firstName },
                        { name: 'lastname', value: formData.lastName },
                        { name: 'email', value: formData.email },
                        { name: 'phone', value: formData.phone },
                        { name: 'role', value: formData.role },
                        { name: 'job_function', value: formData.jobFunction },
                        { name: 'message', value: formData.comments }
                    ],
                    context: {
                        pageUri: window.location.href,
                        pageName: document.title
                    }
                })
            });

            if (!response.ok) {
                // Fallback for development/if IDs are invalid (don't block the user)
                console.warn('HubSpot submission failed (likely due to placeholder IDs):', response.status);
            }

            // Track the successful conversion event
            Analytics.identify(formData.email);
            Analytics.trackEvent('roi_lead_submit');

            onSubmit(formData);
        } catch (err) {
            console.error('Submission error:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    if (!isOpen) return null;

    const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-truv-blue focus:border-truv-blue outline-none transition-all text-gray-900 placeholder-gray-400";
    const selectClass = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-truv-blue focus:border-truv-blue outline-none transition-all text-gray-900 bg-white";
    const labelClass = "block text-sm font-medium text-gray-700 mb-1";

    // Check if form is valid
    const isFormValid = formData.firstName && formData.lastName && formData.email && formData.phone && formData.role && formData.jobFunction;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
                <form onSubmit={handleSubmit}>
                    <div className="text-center mb-6">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'serif', fontStyle: 'italic' }}>Almost done!</h2>
                    </div>

                    <div className="space-y-4">
                        {/* First Name / Last Name */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>First Name</label>
                                <input
                                    name="firstName"
                                    placeholder="First Name"
                                    required
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Last Name</label>
                                <input
                                    name="lastName"
                                    placeholder="Last Name"
                                    required
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        {/* Work Email */}
                        <div>
                            <label className={labelClass}>Work Email</label>
                            <input
                                name="email"
                                type="email"
                                placeholder="Work Email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>

                        {/* Phone Number */}
                        <div>
                            <label className={labelClass}>Phone number</label>
                            <input
                                name="phone"
                                type="tel"
                                placeholder="+1"
                                required
                                value={formData.phone}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>

                        {/* Role / Job Function */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Role</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    required
                                    className={selectClass}
                                >
                                    <option value="">Role</option>
                                    {ROLE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Job Function</label>
                                <select
                                    name="jobFunction"
                                    value={formData.jobFunction}
                                    onChange={handleChange}
                                    required
                                    className={selectClass}
                                >
                                    <option value="">Job Function</option>
                                    {JOB_FUNCTION_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Comments */}
                        <div>
                            <label className={labelClass}>Comments</label>
                            <textarea
                                name="comments"
                                placeholder="Tell us about a problem you're trying to solve"
                                value={formData.comments}
                                onChange={handleChange}
                                rows={3}
                                className={`${inputClass} resize-none`}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !isFormValid}
                        className={`w-full py-4 rounded-full bg-truv-blue text-white font-semibold text-lg hover:bg-truv-blue-dark transition-all transform hover:scale-[1.01] mt-6 flex items-center justify-center gap-2 ${(isSubmitting || !isFormValid) ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </>
                        ) : (
                            'Continue'
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full text-truv-blue font-semibold mt-3 hover:underline"
                    >
                        Back
                    </button>

                    {error && <p className="text-red-500 text-sm text-center mt-3">{error}</p>}

                    <p className="text-xs text-gray-400 text-center mt-4">
                        By clicking "Continue" you agree to Truv's{' '}
                        <a href="https://truv.com/privacy" target="_blank" rel="noopener noreferrer" className="text-truv-blue hover:underline">
                            Privacy Notice
                        </a>.
                    </p>
                </form>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </motion.div>
        </div>
    );
}
