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
        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] RoleDto dto)
    {
        var role = new RoleDefinition
        {
            RoleName = dto.RoleName,
            RoleType = dto.RoleType ?? dto.RoleName.ToLower().Replace(" ", "_"),
            PermissionLevel = dto.PermissionLevel ?? 0,
            CanCreateUsers = dto.CanCreateUsers,
            CanAssignComplaints = dto.CanAssignComplaints,
            CanApproveWorkOrders = dto.CanApproveWorkOrders,
            CanViewFinancials = dto.CanViewFinancials,
        };
        _context.Roles.Add(role);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<RoleDefinition> { Success = true, Data = role });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] RoleDto dto)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        role.RoleName = dto.RoleName;
        role.RoleType = dto.RoleType ?? role.RoleType;
        role.PermissionLevel = dto.PermissionLevel ?? role.PermissionLevel;
        role.CanCreateUsers = dto.CanCreateUsers;
        role.CanAssignComplaints = dto.CanAssignComplaints;
        role.CanApproveWorkOrders = dto.CanApproveWorkOrders;
        role.CanViewFinancials = dto.CanViewFinancials;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Updated" });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        _context.Roles.Remove(role);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Deleted" });
    }
}

public class RoleDto
{
    public string RoleName { get; set; } = string.Empty;
    public string? RoleType { get; set; }
    public int? PermissionLevel { get; set; }
    public bool CanCreateUsers { get; set; }
    public bool CanAssignComplaints { get; set; }
    public bool CanApproveWorkOrders { get; set; }
    public bool CanViewFinancials { get; set; }
}
