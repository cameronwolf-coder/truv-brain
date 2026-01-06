import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface CountUpNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function CountUpNumber({
  value,
  duration = 1.2,
  prefix = '',
  suffix = '',
  className = ''
}: CountUpNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  const spring = useSpring(0, {
    stiffness: 50,
    damping: 15,
    duration: duration * 1000
  });

  const rounded = useTransform(spring, (latest) => Math.round(latest));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = rounded.on('change', (latest) => {
      setDisplayValue(latest);
    });
    return () => unsubscribe();
  }, [rounded]);

  const formattedValue = new Intl.NumberFormat('en-US').format(displayValue);

  return (
    <motion.span className={className}>
      {prefix}{formattedValue}{suffix}
    </motion.span>
  );
}
