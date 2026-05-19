export function useNotifications() {
  return {
    notifications: [],
    unreadCount: 0,
    markAsRead: async (_id: string) => {},
    markAllAsRead: async () => {},
  }
}

