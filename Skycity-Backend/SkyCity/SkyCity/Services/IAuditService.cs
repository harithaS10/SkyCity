using System.Threading.Tasks;

namespace SkycityBackend.Services;

public interface IAuditService
{
    Task LogAsync(string action, string module, int? recordId, object oldValue, object newValue);
    Task LogChangeAsync<T>(string action, string module, T entity, object? oldEntity = null) where T : class;
}
