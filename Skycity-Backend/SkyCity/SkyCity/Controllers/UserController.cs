using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("users")]
public class UserController : ControllerBase
{
    private readonly AppDbContext _context;
    public UserController(AppDbContext context) => _context = context;

    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;
    private bool IsSuperAdmin => User.IsInRole("super_admin");

    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] string? role = null)
    {
        var query = _context.Users.IgnoreQueryFilters()
            .Where(u => u.IsDeleted) // only include IsDeleted=true (active users)
            .AsQueryable();

        // Super admin sees all; others see their association + unassigned users
        if (!IsSuperAdmin && CurrentAssocId > 0)
            query = query.Where(u => u.AssociationId == CurrentAssocId || u.AssociationId == null);

        if (!string.IsNullOrEmpty(role))
            query = query.Where(u => u.Role == Enum.Parse<UserRole>(role));

        var users = await query
            .OrderBy(u => u.FullName)
            .Select(u => new {
                u.Id, u.Username, u.FullName,
                role = u.Role.ToString(),
                u.AssociationId, u.PropertyId, u.BuildingId, u.UnitId,
                u.Phone, u.IsActive, u.CreatedAt,
                u.IsDeleted,
                status = u.IsActive ? "active" : "inactive"
            })
            .ToListAsync();

        return Ok(new ApiResponse<dynamic> { Success = true, Data = users });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        return Ok(new ApiResponse<User> { Success = true, Data = user });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] UpdateUserDto dto)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });

        user.FullName = dto.FullName ?? user.FullName;
        user.Phone = dto.Phone ?? user.Phone;
        user.Address = dto.Address ?? user.Address;
        user.IsActive = dto.IsActive ?? user.IsActive;
        if (!string.IsNullOrEmpty(dto.Role))
        {
            var roleStr = dto.Role == "user" ? "resident" : dto.Role;
            if (Enum.TryParse<UserRole>(roleStr, true, out var parsedRole))
                user.Role = parsedRole;
        }

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Updated" });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Deleted" });
    }

    [HttpPatch("{id}/toggle-status")]
    public async Task<ActionResult> ToggleStatus(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        user.IsActive = !user.IsActive;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = $"User {(user.IsActive ? "activated" : "deactivated")}" });
    }

    // POST /users/bulk — bulk create users
    [HttpPost("bulk")]
    public async Task<ActionResult> BulkCreate([FromBody] BulkUserDto dto)
    {
        if (dto.Users == null || !dto.Users.Any())
            return BadRequest(new ApiResponse { Success = false, Message = "No users provided" });

        var created = new List<object>();
        var errors = new List<string>();

        foreach (var u in dto.Users)
        {
            if (await _context.Users.AnyAsync(x => x.Username == u.Username))
            {
                errors.Add($"Username '{u.Username}' already taken");
                continue;
            }

            var roleStr = u.Role == "user" ? "resident" : (u.Role ?? "staff");
            if (!Enum.TryParse<UserRole>(roleStr, true, out var parsedRole))
                parsedRole = UserRole.staff;

            var user = new User
            {
                Username = u.Username,
                PasswordHash = u.Password,
                FullName = u.FullName,
                Role = parsedRole,
                AssociationId = CurrentAssocId > 0 ? CurrentAssocId : null,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = true,
                IsActive = true
            };
            _context.Users.Add(user);
            created.Add(new { user.Username, user.FullName, role = user.Role.ToString() });
        }

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"Created {created.Count} users. {(errors.Any() ? $"{errors.Count} skipped." : "")}",
            Data = new { created, errors }
        });
    }
}

public class UpdateUserDto
{
    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public bool? IsActive { get; set; }
    public string? Role { get; set; }
}

public class BulkUserItemDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Role { get; set; }
}

public class BulkUserDto
{
    public List<BulkUserItemDto> Users { get; set; } = new();
}
