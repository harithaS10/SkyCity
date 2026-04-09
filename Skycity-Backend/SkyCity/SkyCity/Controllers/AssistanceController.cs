using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("assistance")]
public class AssistanceController : ControllerBase
{
    private readonly AppDbContext _context;
    public AssistanceController(AppDbContext context) => _context = context;

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;

    // Staff: POST /assistance
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateAssistanceDto dto)
    {
        var req = new AssistanceRequest
        {
            UserId = CurrentUserId,
            AssociationId = CurrentAssocId,
            Message = dto.Message ?? "User requested assistance.",
            CreatedAt = DateTime.UtcNow
        };
        _context.AssistanceRequests.Add(req);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Request sent to administrator" });
    }

    // Admin: GET /assistance — get all unread requests for this association
    [HttpGet]
    public async Task<ActionResult> GetAll()
    {
        var items = await _context.AssistanceRequests
            .Where(r => r.AssociationId == CurrentAssocId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var userIds = items.Select(r => r.UserId).Distinct().ToList();
        var users = await _context.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName })
            .ToListAsync();
        var userMap = users.ToDictionary(u => u.Id, u => u.FullName);

        var enriched = items.Select(r => new
        {
            r.Id, r.Message, r.IsRead, r.CreatedAt,
            userName = userMap.GetValueOrDefault(r.UserId, "Unknown"),
            r.UserId
        });

        return Ok(new ApiResponse<dynamic> { Success = true, Data = enriched });
    }

    // Admin: POST /assistance/{id}/read
    [HttpPost("{id}/read")]
    public async Task<ActionResult> MarkRead(int id)
    {
        var req = await _context.AssistanceRequests.FindAsync(id);
        if (req == null || req.AssociationId != CurrentAssocId)
            return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        req.IsRead = true;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true });
    }
}

public class CreateAssistanceDto
{
    public string? Message { get; set; }
}
