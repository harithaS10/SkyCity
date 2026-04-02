using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using System.Text.Json;

namespace SkycityBackend.Services;

public class PermissionService : IPermissionService
{
    private readonly AppDbContext _context;

    // Roles with full access — no DB lookup needed
    private static readonly HashSet<string> FullAccessRoles =
        new(StringComparer.OrdinalIgnoreCase) { "super_admin", "admin", "sub_admin" };

    public PermissionService(AppDbContext context) => _context = context;

    public async Task<bool> HasPermissionAsync(string roleName, string module, string action)
    {
        if (FullAccessRoles.Contains(roleName)) return true;

        var role = await _context.Roles
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.RoleName.ToLower() == roleName.ToLower());

        if (role == null || string.IsNullOrEmpty(role.PermissionsJson)) return false;

        try
        {
            var perms = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(role.PermissionsJson);
            if (perms == null) return false;

            if (!perms.TryGetValue(module, out var modEl)) return false;

            // Boolean shorthand (e.g. "export": true)
            if (modEl.ValueKind == JsonValueKind.True) return true;
            if (modEl.ValueKind == JsonValueKind.False) return false;

            // Object with action keys e.g. { "view": true, "create": false }
            if (modEl.ValueKind == JsonValueKind.Object &&
                modEl.TryGetProperty(action, out var actionEl))
                return actionEl.GetBoolean();
        }
        catch { }

        return false;
    }
}
