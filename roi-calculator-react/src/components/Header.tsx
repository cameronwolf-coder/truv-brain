import { motion } from 'framer-motion';

export function Header() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 bg-white"
    >
      <div className="max-w-4xl mx-auto px-10 py-6 flex items-center justify-start">
        <span className="font-bold text-dark text-[28px] tracking-tight">truv</span>
      </div>
    </motion.header>
  );
}
