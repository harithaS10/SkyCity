using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SkycityBackend.Data;
using SkycityBackend.DTOs;
using SkycityBackend.Models;
using SkycityBackend.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCrypt.Net;

namespace SkycityBackend.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _config;

    public AuthController(AppDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
    }

    [HttpPost("login")]
    public async Task<ActionResult> Login([FromBody] LoginRequest request)
    {
        // IgnoreQueryFilters to find users regardless of IsDeleted state
        User? user;
        try
        {
            user = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Username == request.Username);
        }
        catch (InvalidOperationException)
        {
            // Enum conversion failure — bad Role value in DB
            return Unauthorized(new ApiResponse { Success = false, Message = "Account has an invalid role. Contact administrator." });
        }

        if (user == null)
            return Unauthorized(new ApiResponse { Success = false, Message = "Invalid credentials" });

        if (!user.IsActive)
            return Unauthorized(new ApiResponse { Success = false, Message = "Account is inactive. Contact your administrator." });

        // Support both plain-text (legacy) and BCrypt hashed passwords
        bool passwordValid = user.PasswordHash.StartsWith("$2")
            ? BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash)
            : user.PasswordHash == request.Password;

        if (!passwordValid)
            return Unauthorized(new ApiResponse { Success = false, Message = "Invalid credentials" });

        var token = GenerateJwtToken(user);

        user.LastLoginAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Fetch association branding
        string? logoUrl = null;
        string? themeColor = null;
        string? associationName = null;
        if (user.AssociationId.HasValue)
        {
            var assoc = await _context.Associations.IgnoreQueryFilters()
                .FirstOrDefaultAsync(a => a.Id == user.AssociationId.Value);
            if (assoc != null)
            {
                logoUrl = assoc.LogoUrl;
                themeColor = assoc.ThemeColor;
                associationName = assoc.AssociationName;
            }
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Login successful",
            Data = new
            {
                Token = token,
                User = new
                {
                    user.Id, user.Username, user.FullName,
                    role = user.Role.ToString(),
                    user.AssociationId, user.UnitId,
                    logoUrl,
                    themeColor,
                    associationName
                }
            }
        });
    }

    [HttpPost("register")]
    public async Task<ActionResult> Register([FromBody] UserRegistrationDto dto)
    {
        if (await _context.Users.AnyAsync(u => u.Username == dto.Username))
            return BadRequest(new { Success = false, Message = "Username already taken" });

        var user = new User
        {
            Username = dto.Username,
            PasswordHash = dto.Password,
            FullName = dto.FullName,
            Role = dto.Role,
            AssociationId = dto.AssociationId,
            PropertyId = dto.PropertyId,
            BuildingId = dto.BuildingId,
            UnitId = dto.UnitId,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = true,  // true = active/visible
            IsActive = true
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse { Success = true, Message = "User registered successfully" });
    }

    private string GenerateJwtToken(User user)
    {
        if (user == null) throw new ArgumentNullException(nameof(user));
        var jwtKey = _config["Jwt:Key"] ?? "SkycityReportingSecretKey1234567890";
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("AssociationId", user.AssociationId?.ToString() ?? ""),
            new Claim("PropertyId", user.PropertyId?.ToString() ?? ""),
            new Claim("BuildingId", user.BuildingId?.ToString() ?? ""),
            new Claim("UnitId", user.UnitId?.ToString() ?? "")
        };

        var token = new JwtSecurityToken(
            issuer: null,
            audience: null,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Username, string Password);
public record UserRegistrationDto(
    string Username,
    string Password,
    string FullName,
    UserRole Role,
    int? AssociationId = null,
    int? PropertyId = null,
    int? BuildingId = null,
    int? UnitId = null
);
