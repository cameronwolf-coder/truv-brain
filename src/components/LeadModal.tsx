import { motion } from 'framer-motion';
import { useState } from 'react';
import type { LeadFormData, CalculationResults } from '../types';
import { Analytics } from '../utils/analytics';

interface ROIContext {
    results: CalculationResults;
    fundedLoans: number;
    industry: string;
}

interface LeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: LeadFormData) => void;
    roiContext?: ROIContext;
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

// Systems that Truv has native integrations with
const INTEGRATED_LOS = ['encompass', 'bytepro', 'meridianlink', 'blackknight'];
const INTEGRATED_POS = ['blend', 'encompassconsumerconnect', 'floify', 'ncino'];

const LOS_NAMES: Record<string, string> = {
    encompass: 'Encompass',
    bytepro: 'Byte Pro',
    meridianlink: 'MeridianLink',
    blackknight: 'Black Knight'
};

const POS_NAMES: Record<string, string> = {
    blend: 'Blend',
    encompassconsumerconnect: 'Encompass Consumer Connect',
    floify: 'Floify',
    ncino: 'nCino'
};

export function LeadModal({ isOpen, onClose, onSubmit, roiContext }: LeadModalProps) {
    const [formData, setFormData] = useState<LeadFormData>({
        firstName: '',
        lastName: '',
        companyName: '',
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
        const PORTAL_ID = '19933594';
        const FORM_GUID = 'b4be8619-c0ae-4d63-876d-d69e0ab61a15';

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
                        { name: 'message', value: formData.comments },
                        // ROI calculator data (sent as strings to match HubSpot property types)
                        ...(roiContext ? [
                            { name: 'roi_funded_loans', value: String(roiContext.fundedLoans) },
                            { name: 'roi_annual_savings', value: String(Math.round(roiContext.results.annualSavings)) },
                            { name: 'roi_savings_per_loan', value: String(Math.round(roiContext.results.savingsPerLoan)) },
                            { name: 'roi_current_cost', value: String(Math.round(roiContext.results.currentCost)) },
                            { name: 'roi_truv_cost', value: String(Math.round(roiContext.results.futureCost)) },
                            { name: 'roi_manual_reduction_pct', value: String(Math.round(roiContext.results.manualReduction)) },
                            { name: 'roi_los_system', value: formData.losSystem },
                            { name: 'roi_pos_system', value: formData.posSystem },
                            { name: 'roi_use_case', value: roiContext.industry },
                        ] : []),
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

            // Fire Scout scoring (non-blocking — don't let Scout failures block the user)
            if (roiContext) {
                fetch('https://8svutjrjpz.us-east-1.awsapprunner.com/webhook/roi-calculator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contact_id: '',
                        email: formData.email,
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        company: formData.companyName,
                        funded_loans: roiContext.fundedLoans,
                        annual_savings: Math.round(roiContext.results.annualSavings),
                        current_cost: Math.round(roiContext.results.currentCost),
                        truv_cost: Math.round(roiContext.results.futureCost),
                        los_system: formData.losSystem,
                        pos_system: formData.posSystem,
                        use_case: roiContext.industry,
                    }),
                }).catch(() => {}); // fire-and-forget
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
    const isFormValid = formData.firstName && formData.lastName && formData.companyName && formData.email && formData.phone && formData.role && formData.jobFunction;

    // Check if selected systems have integrations
    const hasLosIntegration = INTEGRATED_LOS.includes(formData.losSystem);
    const hasPosIntegration = INTEGRATED_POS.includes(formData.posSystem);
    const hasAnyIntegration = hasLosIntegration || hasPosIntegration;

    // Build integration message
    const getIntegrationMessage = () => {
        const systems: string[] = [];
        if (hasLosIntegration) systems.push(LOS_NAMES[formData.losSystem]);
        if (hasPosIntegration) systems.push(POS_NAMES[formData.posSystem]);

        if (systems.length === 2) {
            return `Truv has native integrations with ${systems[0]} and ${systems[1]}!`;
        } else if (systems.length === 1) {
            return `Truv has a native integration with ${systems[0]}!`;
        }
        return '';
    };

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
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Almost done!</h2>
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

                        {/* Company Name */}
                        <div>
                            <label className={labelClass}>Company Name</label>
                            <input
                                name="companyName"
                                placeholder="Company Name"
                                required
                                value={formData.companyName}
                                onChange={handleChange}
                                className={inputClass}
                            />
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

                        {/* LOS / POS Systems */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>LOS System</label>
                                <select
                                    name="losSystem"
                                    value={formData.losSystem}
                                    onChange={handleChange}
                                    className={selectClass}
                                >
                                    <option value="">Select LOS</option>
                                    <option value="encompass">Encompass (ICE)</option>
                                    <option value="bytepro">Byte Pro</option>
                                    <option value="meridianlink">MeridianLink</option>
                                    <option value="blackknight">Black Knight</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>POS System</label>
                                <select
                                    name="posSystem"
                                    value={formData.posSystem}
                                    onChange={handleChange}
                                    className={selectClass}
                                >
                                    <option value="">Select POS</option>
                                    <option value="blend">Blend</option>
                                    <option value="encompassconsumerconnect">Encompass CC</option>
                                    <option value="floify">Floify</option>
                                    <option value="ncino">nCino</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        {/* Integration Badge */}
                        {hasAnyIntegration && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl"
                            >
                                <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-green-800">Great news!</p>
                                    <p className="text-sm text-green-700">{getIntegrationMessage()}</p>
                                    <p className="text-xs text-green-600 mt-1">This means faster implementation and seamless data flow.</p>
                                </div>
                            </motion.div>
                        )}

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
