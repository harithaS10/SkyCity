using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using SkycityBackend.Data;
using SkycityBackend.Models;

namespace SkycityBackend.Services;

public class AuditService : IAuditService
{
    private readonly AppDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuditService(AppDbContext context, IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task LogAsync(string action, string module, int? recordId, object oldValue, object newValue)
    {
        var userId = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var associationId = _httpContextAccessor.HttpContext?.User.FindFirst("AssociationId")?.Value;

        if (string.IsNullOrEmpty(userId)) return;

        // Skip audit log if AssociationId is 0 or missing (e.g. super_admin has no association)
        if (!int.TryParse(associationId, out var assocIdParsed) || assocIdParsed == 0) return;

        var auditLog = new AuditLog
        {
            UserId = int.Parse(userId),
            AssociationId = assocIdParsed,
            Action = action,
            Module = module,
            RecordId = recordId,
            OldValue = oldValue != null ? JsonSerializer.Serialize(oldValue) : null,
            NewValue = newValue != null ? JsonSerializer.Serialize(newValue) : null,
            IPAddress = _httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString(),
            UserAgent = _httpContextAccessor.HttpContext?.Request.Headers["User-Agent"].ToString(),
            Timestamp = DateTime.UtcNow
        };

        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
    }

    public async Task LogChangeAsync<T>(string action, string module, T entity, object? oldEntity = null) where T : class
    {
        var idProperty = entity.GetType().GetProperty("Id");
        var recordId = idProperty?.GetValue(entity) as int?;

        await LogAsync(action, module, recordId, oldEntity, entity);
    }
}
