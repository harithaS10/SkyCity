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
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username == request.Username);

        if (user == null || user.PasswordHash != request.Password)
            return Unauthorized(new ApiResponse { Success = false, Message = "Invalid credentials" });

        var token = GenerateJwtToken(user);

        user.LastLoginAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Login successful",
            Data = new
            {
                Token = token,
                User = new { user.Id, user.Username, user.FullName, role = user.Role.ToString(), user.AssociationId, user.UnitId }
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
            CreatedAt = DateTime.UtcNow
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
            expires: DateTime.UtcNow.AddDays(1),
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
