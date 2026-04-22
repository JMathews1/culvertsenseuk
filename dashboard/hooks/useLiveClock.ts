'use client';
import { useState, useEffect } from 'react';

export default function useLiveClock(): string {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const t = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Europe/London',
      });
      setTime(`${t} BST`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}
