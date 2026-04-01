'use client';
import { useState, useEffect } from 'react';

export default function useLiveClock(): string {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const t = new Date().toLocaleTimeString('en-CA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'America/Halifax',
      });
      setTime(`${t} ADT`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}
