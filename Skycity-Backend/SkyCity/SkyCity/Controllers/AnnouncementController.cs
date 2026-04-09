using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;

namespace SkycityBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AnnouncementController : ControllerBase
{
    private readonly AppDbContext _db;

    public AnnouncementController(AppDbContext db)
    {
        _db = db;
    }

    // GET api/announcement  — returns all active (non-deleted) announcements for the tenant
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var assocId = _db.CurrentAssociationId;
        if (assocId == null) return Unauthorized();

        var list = await _db.Announcements
            .Where(a => a.CompanyId == assocId)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new
            {
                a.Id,
                a.CompanyId,
                a.Message,
                a.StartAt,
                a.EndAt,
                a.IsActive,
                a.CreatedAt
            })
            .ToListAsync();

        return Ok(new { success = true, data = list });
    }

    // GET api/announcement/active  — only currently active & within date range
    [HttpGet("active")]
    [AllowAnonymous]
    public async Task<IActionResult> GetActive()
    {
        var assocId = _db.CurrentAssociationId;
        if (assocId == null) return Unauthorized();

        var now = DateTime.UtcNow;
        var list = await _db.Announcements
            .Where(a => a.CompanyId == assocId && a.IsActive && a.StartAt <= now && a.EndAt >= now)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new { a.Id, a.Message, a.StartAt, a.EndAt })
            .ToListAsync();

        return Ok(new { success = true, data = list });
    }

    // POST api/announcement
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AnnouncementRequest req)
    {
        var assocId = _db.CurrentAssociationId;
        if (assocId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(req.Message))
            return BadRequest(new { success = false, message = "Message is required" });

        if (req.EndAt <= req.StartAt)
            return BadRequest(new { success = false, message = "EndAt must be after StartAt" });

        var announcement = new Announcement
        {
            CompanyId = assocId.Value,
            Message   = req.Message.Trim(),
            StartAt   = req.StartAt,
            EndAt     = req.EndAt,
            IsActive  = req.IsActive,
        };

        _db.Announcements.Add(announcement);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, data = announcement });
    }

    // PATCH api/announcement/{id}/toggle  — toggle IsActive
    [HttpPatch("{id:int}/toggle")]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var assocId = _db.CurrentAssociationId;
        var announcement = await _db.Announcements
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == assocId);

        if (announcement == null) return NotFound(new { success = false, message = "Not found" });

        announcement.IsActive = !announcement.IsActive;
        await _db.SaveChangesAsync();

        return Ok(new { success = true, data = new { announcement.Id, announcement.IsActive } });
    }

    // DELETE api/announcement/{id}  — soft delete (sets IsDeleted = false)
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var assocId = _db.CurrentAssociationId;
        var announcement = await _db.Announcements
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == assocId);

        if (announcement == null) return NotFound(new { success = false, message = "Not found" });

        // Soft delete — EF's UpdateSoftDeleteStatus in SaveChanges handles this automatically
        // but we can also do it explicitly for clarity:
        announcement.IsDeleted = false;
        await _db.SaveChangesAsync();

        return Ok(new { success = true, message = "Announcement deleted" });
    }
}

public record AnnouncementRequest(
    string Message,
    DateTime StartAt,
    DateTime EndAt,
    bool IsActive = true
);
