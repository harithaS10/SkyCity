import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://www.vivifysoft.in/VivifyReports';

export interface TaskStatusUpdate {
  taskId: number;
  status: string;
  updatedBy: number;
  updatedByName: string;
  systemMessage: string;
  systemMessageId?: number;
  timestamp?: string;
}

export interface TaskUserStatusUpdate {
  taskId: number;
  userId: number;
  userName: string;
  status: string;
  groupId: number;
}

export interface ChatMsg {
  id: number;
  senderId: number;
  senderName: string;
  receiverId: number | null;
  groupId?: number | null;
  message: string;
  type: 'text' | 'task' | 'system';
  taskPayload?: string;
  createdAt: string;
  isRead: boolean;
}

export function useChat(enabled: boolean) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<number, boolean>>({});
  const messageHandlers = useRef<((msg: ChatMsg) => void)[]>([]);
  const groupMessageHandlers = useRef<((msg: ChatMsg) => void)[]>([]);
  const taskStatusHandlers = useRef<((update: TaskStatusUpdate) => void)[]>([]);
  const taskUserStatusHandlers = useRef<((update: TaskUserStatusUpdate) => void)[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/chatHub`, {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ReceiveMessage', (msg: ChatMsg) => {
      messageHandlers.current.forEach(h => h(msg));
    });

    connection.on('ReceiveGroupMessage', (msg: ChatMsg) => {
      groupMessageHandlers.current.forEach(h => h(msg));
    });

    connection.on('TaskStatusUpdated', (update: TaskStatusUpdate) => {
      taskStatusHandlers.current.forEach(h => h(update));
    });

    connection.on('TaskUserStatusUpdated', (update: TaskUserStatusUpdate) => {
      taskUserStatusHandlers.current.forEach(h => h(update));
    });

    connection.on('UserTyping', ({ senderId, isTyping }: { senderId: number; isTyping: boolean }) => {
      setTypingUsers(prev => ({ ...prev, [senderId]: isTyping }));
    });

    connection.start()
      .then(() => setConnected(true))
      .catch(err => console.error('ChatHub connect error:', err));

    connectionRef.current = connection;

    return () => {
      connection.stop();
      connectionRef.current = null;
      setConnected(false);
    };
  }, [enabled]);

  const onMessage = useCallback((handler: (msg: ChatMsg) => void) => {
    messageHandlers.current.push(handler);
    return () => {
      messageHandlers.current = messageHandlers.current.filter(h => h !== handler);
    };
  }, []);

  const onGroupMessage = useCallback((handler: (msg: ChatMsg) => void) => {
    groupMessageHandlers.current.push(handler);
    return () => {
      groupMessageHandlers.current = groupMessageHandlers.current.filter(h => h !== handler);
    };
  }, []);

  const onTaskStatusUpdate = useCallback((handler: (update: TaskStatusUpdate) => void) => {
    taskStatusHandlers.current.push(handler);
    return () => {
      taskStatusHandlers.current = taskStatusHandlers.current.filter(h => h !== handler);
    };
  }, []);

  const onTaskUserStatusUpdate = useCallback((handler: (update: TaskUserStatusUpdate) => void) => {
    taskUserStatusHandlers.current.push(handler);
    return () => {
      taskUserStatusHandlers.current = taskUserStatusHandlers.current.filter(h => h !== handler);
    };
  }, []);

  const sendMessage = useCallback(async (receiverId: number, message: string) => {
    await connectionRef.current?.invoke('SendMessage', receiverId, message);
  }, []);

  const sendTaskMessage = useCallback(async (receiverId: number, taskJson: string) => {
    await connectionRef.current?.invoke('SendTaskMessage', receiverId, taskJson);
  }, []);

  const sendGroupMessage = useCallback(async (groupId: number, message: string) => {
    await connectionRef.current?.invoke('SendGroupMessage', groupId, message);
  }, []);

  const sendGroupTaskMessage = useCallback(async (groupId: number, taskJson: string) => {
    await connectionRef.current?.invoke('SendGroupTaskMessage', groupId, taskJson);
  }, []);

  const updateTaskStatus = useCallback(async (taskId: number, status: string) => {
    await connectionRef.current?.invoke('UpdateTaskStatus', taskId, status);
  }, []);

  const updateGroupTaskUserStatus = useCallback(async (taskId: number, status: string) => {
    // Uses REST so the server can look up the groupId and broadcast correctly
    const token = localStorage.getItem('authToken');
    await fetch(`${BASE_URL}/api/groups/task/${taskId}/my-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status }),
    });
  }, []);

  const joinGroup = useCallback(async (groupId: number) => {
    await connectionRef.current?.invoke('JoinGroup', groupId);
  }, []);

  const markRead = useCallback(async (senderId: number) => {
    await connectionRef.current?.invoke('MarkRead', senderId);
  }, []);

  const sendTyping = useCallback(async (receiverId: number, isTyping: boolean) => {
    await connectionRef.current?.invoke('Typing', receiverId, isTyping);
  }, []);

  return {
    connected,
    typingUsers,
    onMessage,
    onGroupMessage,
    onTaskStatusUpdate,
    onTaskUserStatusUpdate,
    sendMessage,
    sendTaskMessage,
    sendGroupMessage,
    sendGroupTaskMessage,
    updateTaskStatus,
    updateGroupTaskUserStatus,
    joinGroup,
    markRead,
    sendTyping,
  };
}
