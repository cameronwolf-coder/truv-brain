import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';

interface ScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const timeSlots = [
    '9:00 AM',
    '10:30 AM',
    '1:00 PM',
    '2:30 PM',
    '3:30 PM',
    '4:30 PM'
];

export function ScheduleModal({ isOpen, onClose }: ScheduleModalProps) {
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [isConfirmed, setIsConfirmed] = useState(false);

    // Generate calendar data for current month
    const calendarData = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        return { year, month, firstDay, daysInMonth, monthName, today: today.getDate() };
    }, []);

    const getDayName = (day: number) => {
        const date = new Date(calendarData.year, calendarData.month, day);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const handleConfirm = () => {
        setIsConfirmed(true);
        // In production, this would submit to a backend/CRM
        setTimeout(() => {
            onClose();
            setIsConfirmed(false);
            setSelectedDay(null);
            setSelectedTime(null);
        }, 2000);
    };

    const isValid = selectedDay && selectedTime;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>

                        <div className="p-8">
                            {isConfirmed ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-8"
                                >
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                                            <path d="M20 6L9 17l-5-5"/>
                                        </svg>
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h2>
                                    <p className="text-gray-600">
                                        We've scheduled your call for {getDayName(selectedDay!)} at {selectedTime}.
                                    </p>
                                    <p className="text-sm text-gray-500 mt-4">
                                        Check your email for a calendar invite.
                                    </p>
                                </motion.div>
                            ) : (
                                <>
                                    {/* Header */}
                                    <div className="text-center mb-6">
                                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Schedule a Call</h2>
                                        <p className="text-gray-500">Pick a time that works for you</p>
                                    </div>

                                    {/* Calendar */}
                                    <div className="bg-gray-50 rounded-xl p-6 mb-6">
                                        {/* Month header */}
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="font-semibold text-gray-900">{calendarData.monthName}</span>
                                            <div className="flex gap-2">
                                                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M15 18l-6-6 6-6"/>
                                                    </svg>
                                                </button>
                                                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M9 18l6-6-6-6"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Day headers */}
                                        <div className="grid grid-cols-7 gap-1 mb-2">
                                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                                <div key={day} className="text-center text-xs font-semibold text-gray-400 py-2">
                                                    {day}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Calendar grid */}
                                        <div className="grid grid-cols-7 gap-1">
                                            {/* Empty cells for first day offset */}
                                            {Array.from({ length: calendarData.firstDay }).map((_, i) => (
                                                <div key={`empty-${i}`} className="p-2" />
                                            ))}

                                            {/* Days */}
                                            {Array.from({ length: calendarData.daysInMonth }).map((_, i) => {
                                                const day = i + 1;
                                                const isPast = day < calendarData.today;
                                                const isWeekend = (() => {
                                                    const date = new Date(calendarData.year, calendarData.month, day);
                                                    const dayOfWeek = date.getDay();
                                                    return dayOfWeek === 0 || dayOfWeek === 6;
                                                })();
                                                const isDisabled = isPast || isWeekend;
                                                const isSelected = selectedDay === day;

                                                return (
                                                    <button
                                                        key={day}
                                                        onClick={() => !isDisabled && setSelectedDay(day)}
                                                        disabled={isDisabled}
                                                        className={`
                                                            p-2 text-sm rounded-lg transition-colors
                                                            ${isDisabled
                                                                ? 'text-gray-300 cursor-not-allowed'
                                                                : isSelected
                                                                    ? 'bg-truv-blue text-white'
                                                                    : 'hover:bg-truv-blue-light text-gray-900'
                                                            }
                                                        `}
                                                    >
                                                        {day}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Time slots */}
                                        {selectedDay && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="mt-4 pt-4 border-t border-gray-200"
                                            >
                                                <div className="text-sm font-medium text-gray-700 mb-3">
                                                    Available times for {getDayName(selectedDay)}
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {timeSlots.map(time => (
                                                        <button
                                                            key={time}
                                                            onClick={() => setSelectedTime(time)}
                                                            className={`
                                                                px-3 py-2 text-sm rounded-lg border transition-colors
                                                                ${selectedTime === time
                                                                    ? 'bg-truv-blue text-white border-truv-blue'
                                                                    : 'border-gray-200 hover:border-truv-blue hover:bg-truv-blue-light'
                                                                }
                                                            `}
                                                        >
                                                            {time}
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Confirm button */}
                                    <button
                                        onClick={handleConfirm}
                                        disabled={!isValid}
                                        className={`
                                            w-full py-4 rounded-xl font-semibold transition-all
                                            ${isValid
                                                ? 'bg-truv-blue text-white hover:bg-truv-blue-dark'
                                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            }
                                        `}
                                    >
                                        {isValid
                                            ? `Confirm: ${getDayName(selectedDay!)} at ${selectedTime}`
                                            : 'Select a date and time'
                                        }
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
