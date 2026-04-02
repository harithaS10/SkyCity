namespace SkycityBackend.Services;

public interface IPermissionService
{
    Task<bool> HasPermissionAsync(string roleName, string module, string action);
}
