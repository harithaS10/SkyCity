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

        var assocId = IsSuperAdmin ? (dto.AssociationId ?? CurrentAssocId) : CurrentAssocId;

        // Prevent duplicates: same email within the same association (only active/non-deleted clients)
        var emailDuplicate = await _context.Clients
            .Where(c => c.AssociationId == assocId && c.IsDeleted)
            .FirstOrDefaultAsync(c => c.Email.ToLower() == dto.Email.ToLower().Trim());

        if (emailDuplicate != null)
            return BadRequest(new ApiResponse { Success = false, Message = $"Email \"{dto.Email}\" is already used by client \"{emailDuplicate.Name}\"." });

        var nameDuplicate = await _context.Clients
            .Where(c => c.AssociationId == assocId && c.IsDeleted)
            .FirstOrDefaultAsync(c => c.Name.ToLower() == dto.Name.ToLower().Trim());

        if (nameDuplicate != null)
            return BadRequest(new ApiResponse { Success = false, Message = $"A client named \"{nameDuplicate.Name}\" already exists." });

        var client = new Client
        {
            AssociationId = assocId,
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

    // POST /clients/bulk — bulk create clients, skipping duplicates
    [HttpPost("bulk")]
    public async Task<ActionResult> BulkCreate([FromBody] BulkClientDto dto)
    {
        if (dto.Clients == null || !dto.Clients.Any())
            return BadRequest(new ApiResponse { Success = false, Message = "No clients provided" });

        var assocId = CurrentAssocId;

        // Load existing names and emails for this association (only non-deleted clients)
        var existingNames = await _context.Clients
            .Where(c => c.AssociationId == assocId && c.IsDeleted)
            .Select(c => c.Name.ToLower())
            .ToListAsync();
        var existingEmails = await _context.Clients
            .Where(c => c.AssociationId == assocId && c.IsDeleted)
            .Select(c => c.Email.ToLower())
            .ToListAsync();

        var toAdd = new List<Client>();
        var skipped = new List<string>();

        foreach (var c in dto.Clients)
        {
            if (existingNames.Contains(c.Name.ToLower()))
            {
                skipped.Add($"Client \"{c.Name}\" already exists");
                continue;
            }
            if (existingEmails.Contains(c.Email.ToLower()))
            {
                skipped.Add($"Email \"{c.Email}\" already exists");
                continue;
            }
            toAdd.Add(new Client
            {
                AssociationId = IsSuperAdmin ? (c.AssociationId ?? assocId) : assocId,
                Name = c.Name,
                Company = c.Company,
                Email = c.Email,
                Phone = c.Phone,
                LogoUrl = c.LogoUrl,
                IsActive = c.IsActive ?? true,
                CreatedAt = DateTime.UtcNow
            });
            // Track in-memory to catch duplicates within the same batch
            existingNames.Add(c.Name.ToLower());
            existingEmails.Add(c.Email.ToLower());
        }

        if (toAdd.Count > 0)
        {
            _context.Clients.AddRange(toAdd);
            await _context.SaveChangesAsync();
        }

        return Ok(new ApiResponse<dynamic>
        {
            Success = true,
            Data = new { created = toAdd.Count, skipped = skipped.Count, skippedDetails = skipped }
        });
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
