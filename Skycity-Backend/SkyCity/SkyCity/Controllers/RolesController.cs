using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("roles")]
public class RolesController : ControllerBase
{
    private readonly AppDbContext _context;
    public RolesController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<ActionResult> GetAll()
    {
        var items = await _context.Roles.ToListAsync();
        var result = items.Select(r => ToDto(r));
        return Ok(new ApiResponse<object> { Success = true, Data = result });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] RoleDto dto)
    {
        var role = new RoleDefinition
        {
            RoleName = dto.RoleName,
            RoleType = dto.RoleType ?? dto.RoleName.ToLower().Replace(" ", "_"),
            PermissionLevel = 0,
            CanCreateUsers = dto.Permissions?.ContainsKey("users") == true,
            CanAssignComplaints = dto.Permissions?.ContainsKey("complaints") == true,
            CanApproveWorkOrders = dto.Permissions?.ContainsKey("work_orders") == true,
            CanViewFinancials = dto.Permissions?.ContainsKey("analytics") == true,
            PermissionsJson = System.Text.Json.JsonSerializer.Serialize(dto.Permissions ?? new()),
        };
        _context.Roles.Add(role);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Success = true, Data = ToDto(role) });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] RoleDto dto)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        role.RoleName = dto.RoleName;
        role.RoleType = dto.RoleType ?? role.RoleType;
        role.PermissionsJson = System.Text.Json.JsonSerializer.Serialize(dto.Permissions ?? new());
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Success = true, Data = ToDto(role) });
    }

    private static object ToDto(RoleDefinition r) => new
    {
        r.Id,
        r.RoleName,
        permissions = string.IsNullOrEmpty(r.PermissionsJson)
            ? new object()
            : System.Text.Json.JsonSerializer.Deserialize<object>(r.PermissionsJson)
    };

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        _context.Roles.Remove(role);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Deleted" });
    }

    // POST /roles/bulk — bulk create roles
    [HttpPost("bulk")]
    public async Task<ActionResult> BulkCreate([FromBody] BulkRoleDto dto)
    {
        if (dto.Roles == null || !dto.Roles.Any())
            return BadRequest(new ApiResponse { Success = false, Message = "No roles provided" });

        var roles = dto.Roles.Select(r => new RoleDefinition
        {
            RoleName = r.RoleName,
            RoleType = r.RoleType ?? r.RoleName.ToLower().Replace(" ", "_"),
            PermissionLevel = 0,
            CanCreateUsers = r.Permissions?.ContainsKey("users") == true,
            CanAssignComplaints = r.Permissions?.ContainsKey("complaints") == true,
            CanApproveWorkOrders = r.Permissions?.ContainsKey("work_orders") == true,
            CanViewFinancials = r.Permissions?.ContainsKey("analytics") == true,
            PermissionsJson = System.Text.Json.JsonSerializer.Serialize(r.Permissions ?? new()),
            IsDeleted = true
        }).ToList();

        _context.Roles.AddRange(roles);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<List<object>> { Success = true, Data = roles.Select(r => ToDto(r)).ToList() });
    }
}

public class RoleDto
{
    public string RoleName { get; set; } = string.Empty;
    public string? RoleType { get; set; }
    public Dictionary<string, object>? Permissions { get; set; }
}

public class BulkRoleDto
{
    public List<RoleDto> Roles { get; set; } = new();
}
