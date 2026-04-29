using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("clients")]
public class ClientsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ClientsController(AppDbContext context) => _context = context;

    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;
    private bool IsSuperAdmin => User.IsInRole("super_admin");

    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] string? search)
    {
        var query = _context.Clients.AsQueryable();

        if (!IsSuperAdmin)
            query = query.Where(c => c.AssociationId == CurrentAssocId);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(c =>
                c.Name.Contains(search) ||
                c.Company.Contains(search) ||
                c.Email.Contains(search));

        var clients = await query.OrderByDescending(c => c.CreatedAt).ToListAsync();
        return Ok(new ApiResponse<List<Client>> { Success = true, Data = clients });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] ClientDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(new ApiResponse { Success = false, Message = "Invalid input" });

        var client = new Client
        {
            AssociationId = IsSuperAdmin ? (dto.AssociationId ?? CurrentAssocId) : CurrentAssocId,
            Name = dto.Name,
            Company = dto.Company,
            Email = dto.Email,
            Phone = dto.Phone,
            LogoUrl = dto.LogoUrl,
            IsActive = dto.IsActive ?? true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Clients.Add(client);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<Client> { Success = true, Data = client });
    }

    [HttpPost("{id}/update")]
    public async Task<ActionResult> Update(int id, [FromBody] ClientDto dto)
    {
        var client = await _context.Clients.FindAsync(id);
        if (client == null)
            return NotFound(new ApiResponse { Success = false, Message = "Client not found" });

        if (!IsSuperAdmin && client.AssociationId != CurrentAssocId)
            return Forbid();

        client.Name = dto.Name ?? client.Name;
        client.Company = dto.Company ?? client.Company;
        client.Email = dto.Email ?? client.Email;
        client.Phone = dto.Phone ?? client.Phone;
        client.LogoUrl = dto.LogoUrl ?? client.LogoUrl;
        client.IsActive = dto.IsActive ?? client.IsActive;

        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<Client> { Success = true, Data = client });
    }

    [HttpPost("{id}/delete")]
    public async Task<ActionResult> Delete(int id)
    {
        var client = await _context.Clients.FindAsync(id);
        if (client == null)
            return NotFound(new ApiResponse { Success = false, Message = "Client not found" });

        if (!IsSuperAdmin && client.AssociationId != CurrentAssocId)
            return Forbid();

        _context.Clients.Remove(client); // soft delete via SaveChanges override
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse { Success = true, Message = "Client deleted" });
    }

    // POST /clients/bulk — bulk create clients
    [HttpPost("bulk")]
    public async Task<ActionResult> BulkCreate([FromBody] BulkClientDto dto)
    {
        if (dto.Clients == null || !dto.Clients.Any())
            return BadRequest(new ApiResponse { Success = false, Message = "No clients provided" });

        var clients = dto.Clients.Select(c => new Client
        {
            AssociationId = IsSuperAdmin ? (c.AssociationId ?? CurrentAssocId) : CurrentAssocId,
            Name = c.Name,
            Company = c.Company,
            Email = c.Email,
            Phone = c.Phone,
            LogoUrl = c.LogoUrl,
            IsActive = c.IsActive ?? true,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        _context.Clients.AddRange(clients);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<List<Client>> { Success = true, Data = clients });
    }
}

public record ClientDto(
    string Name,
    string Company,
    string Email,
    string? Phone,
    string? LogoUrl,
    bool? IsActive,
    int? AssociationId
);

public class BulkClientDto
{
    public List<ClientDto> Clients { get; set; } = new();
}
