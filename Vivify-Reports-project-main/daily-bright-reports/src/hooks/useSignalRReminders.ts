import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://www.vivifysoft.in/VivifyReports';

export interface ReminderPayload {
  taskId: number;
  taskName: string;
  priority: string;
  dueDate: string;
  message: string;
}

export function useSignalRReminders(
  enabled: boolean,
  onReminder: (payload: ReminderPayload) => void
) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/notificationHub`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ReceiveReminder', (payload: ReminderPayload) => {
      onReminder(payload);
    });

    connection.start().catch(err =>
      console.warn('[SignalR] Connection failed:', err)
    );

    connectionRef.current = connection;

    return () => {
      connection.stop();
    };
  }, [enabled]);
}
