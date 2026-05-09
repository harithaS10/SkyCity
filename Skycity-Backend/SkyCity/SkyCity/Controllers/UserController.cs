using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Attributes;
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
        user.Username = dto.Username ?? user.Username;
        // user.Email = dto.Email ?? user.Email; // TODO: Add Email column to database first
        user.Phone = dto.Phone ?? user.Phone;
        user.Address = dto.Address ?? user.Address;
        user.IsActive = dto.IsActive ?? user.IsActive;
        
        // Update password if provided
        if (!string.IsNullOrEmpty(dto.Password))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
        }
        
        if (!string.IsNullOrEmpty(dto.Role))
        {
            var roleStr = dto.Role == "user" ? "resident" : dto.Role;
            
            // Try to parse as enum first
            if (Enum.TryParse<UserRole>(roleStr, true, out var parsedRole))
            {
                user.Role = parsedRole;
            }
            else
            {
                // If not a valid enum, map custom role names to enum values
                var roleMapping = new Dictionary<string, UserRole>(StringComparer.OrdinalIgnoreCase)
                {
                    { "admin", UserRole.admin },
                    { "staff", UserRole.staff },
                    { "tester", UserRole.staff },
                    { "site_manager", UserRole.property_manager },
                    { "field_supervisor", UserRole.facility_manager },
                    { "super_admin", UserRole.super_admin },
                    { "property_manager", UserRole.property_manager },
                    { "facility_manager", UserRole.facility_manager },
                    { "vendor", UserRole.vendor },
                    { "resident", UserRole.resident },
                    { "accountant", UserRole.accountant },
                    { "helpdesk", UserRole.helpdesk },
                    { "sub_admin", UserRole.sub_admin },
                };
                
                if (roleMapping.TryGetValue(roleStr, out var mappedRole))
                {
                    user.Role = mappedRole;
                }
                else
                {
                    // For any new custom role not in the mapping, default to staff
                    user.Role = UserRole.staff;
                }
            }
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

        // Load all existing users including soft-deleted ones
        var existingUsers = await _context.Users
            .IgnoreQueryFilters()
            .Where(u => u.AssociationId == CurrentAssocId || CurrentAssocId == 0)
            .ToListAsync();

        var existingMap = existingUsers
            .ToDictionary(u => u.Username.ToLower(), u => u);

        foreach (var u in dto.Users)
        {
            var roleStr = u.Role == "user" ? "resident" : (u.Role ?? "staff");
            if (!Enum.TryParse<UserRole>(roleStr, true, out var parsedRole))
                parsedRole = UserRole.staff;

            if (existingMap.TryGetValue(u.Username.ToLower(), out var existing))
            {
                if (existing.IsDeleted)
                {
                    // IsDeleted=true means active — user exists and is active, skip
                    errors.Add($"Username '{u.Username}' already exists");
                    continue;
                }
                else
                {
                    // IsDeleted=false means soft-deleted — restore the user
                    existing.IsDeleted = true;
                    existing.IsActive = true;
                    existing.FullName = u.FullName;
                    existing.PasswordHash = u.Password;
                    existing.Role = parsedRole;
                    created.Add(new { existing.Username, existing.FullName, role = existing.Role.ToString() });
                    continue;
                }
            }

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
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string? Password { get; set; }
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
