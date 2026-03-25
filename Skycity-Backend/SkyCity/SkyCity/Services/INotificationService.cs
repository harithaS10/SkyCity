using System.Collections.Generic;
using System.Threading.Tasks;

namespace SkycityBackend.Services;

public interface INotificationService
{
    Task SendAsync(int userId, string title, string message, string type, int referenceId);
    Task SendBulkAsync(List<int> userIds, string title, string message, string type, int referenceId);
    Task<int> GetUnreadCountAsync(int userId);
    Task MarkAsReadAsync(int notificationId);
}
